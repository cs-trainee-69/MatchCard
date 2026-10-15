// Public game SDK. Never pass a member refresh token or backend game credential to a game.
export class GameCenterGame {
  constructor({
    baseUrl,
    gameId,
    grant,
    fetchImpl = (...args) => globalThis.fetch(...args),
  }) {
    const url = new URL(baseUrl);
    if (
      url.protocol !== "https:" &&
      !(
        url.protocol === "http:" &&
        ["localhost", "127.0.0.1"].includes(url.hostname)
      )
    )
      throw new Error("HTTPS API required");
    this.baseUrl = url.origin;
    this.gameId = gameId;
    this.grant = grant;
    this.fetch = fetchImpl;
  }
  async request(path, body, key, token = this.session?.playToken, method = "POST") {
    const response = await this.fetch(
      `${this.baseUrl}/api/v1/games/${encodeURIComponent(this.gameId)}${path}`,
      {
        method,
        headers: {
          "Content-Type": "application/json",
          ...(token
            ? { Authorization: `Bearer ${token}` }
            : {}),
          ...(key ? { "Idempotency-Key": key } : {}),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        signal: AbortSignal.timeout(15000),
        credentials: "omit",
      },
    );
    const result = await response.json();
    if (!response.ok)
      throw Object.assign(
        new Error(result.error?.message || "Game API failed"),
        { status: response.status, code: result.error?.code },
      );
    return result.data;
  }
  async connect() {
    this.session = await this.request("/launch-grants/exchange", {
      grant: this.grant,
    });
    this.grant = undefined;
    return this.session;
  }
  async replay({ mode = this.session?.context?.mode } = {}) {
    if (!this.session?.replayToken)
      throw Object.assign(new Error("สิทธิ์เปิดรอบใหม่ไม่พร้อม กรุณาเข้าเกมอีกครั้ง"), { code: "replay_not_available" });
    if(this.replayKey && this.replayMode!==mode)throw new Error("Retry mode must match the requested round");
    if (this.nextClient) return this.nextClient;
    if (this.replaying) return this.replaying;
    this.replayMode=mode;
    this.replayKey ??= crypto.randomUUID();
    this.replaying = (async () => {
      const session = await this.request(
        `/play-sessions/${this.session.playSessionId}/replay`, {mode}, this.replayKey, this.session.replayToken,
      );
      const next = new GameCenterGame({ baseUrl: this.baseUrl, gameId: this.gameId, fetchImpl: this.fetch });
      next.session = session;
      return (this.nextClient = next);
    })().catch((error) => {
      // A definitive closed round can use a fresh key on the next user attempt.
      if (["session_closed","incompatible_game","scoring_disabled"].includes(error.code)) {this.replayKey = undefined;this.replayMode=undefined;}
      throw error;
    }).finally(() => { this.replaying = null; });
    return this.replaying;
  }
  async personalBest(mode = this.session?.context?.mode || "default") {
    if (!this.session?.replayToken) throw new Error("Connect before reading personal scores");
    return this.request(`/personal-best?mode=${encodeURIComponent(mode)}`, undefined, undefined, this.session.replayToken, "GET");
  }
  async createChallenge() {
    if(!this.receipt?.rankingEligible || this.session?.context?.memberKindAtStart!=='registered')
      throw Object.assign(new Error('สมัครฟรีเพื่อบันทึกคะแนนและท้าเพื่อน'),{code:'signin_required'});
    this.challengeKey ??= crypto.randomUUID();
    return this.request(`/play-sessions/${this.session.playSessionId}/challenges`,{},this.challengeKey);
  }
  async createBestChallenge({mode=this.session?.context?.mode || 'default',idempotencyKey}={}) {
    if(!this.session?.replayToken)
      throw Object.assign(new Error('Connect before creating a challenge'),{code:'unauthorized',status:401});
    if(typeof idempotencyKey!=='string' || !idempotencyKey.trim() || idempotencyKey.length>100)
      throw new Error('Supply one Idempotency-Key per challenge action and reuse it on retries');
    return this.request('/challenges/best',{mode},idempotencyKey,this.session.replayToken);
  }
  async readRecording(id) {
    return this.request(`/recordings/${encodeURIComponent(id)}`,undefined,undefined,this.session?.replayToken,'GET');
  }
  async saveRecording(body) {
    const payload=JSON.stringify(body);
    if(this.recordingPayload && this.recordingPayload!==payload)throw new Error('Round already has a different recording');
    this.recordingPayload=payload;
    for(let attempt=0;attempt<3;attempt++)try{
      return await this.request(`/play-sessions/${this.session.playSessionId}/recording`,JSON.parse(payload));
    }catch(error){if((error.status&&error.status<500&&error.status!==429)||attempt===2)throw error;await new Promise(resolve=>setTimeout(resolve,500*(attempt+1)));}
  }
  async finish(result) {
    if (!this.session) throw new Error("Connect before submitting");
    if (this.final && JSON.stringify(result) !== this.final.payload)
      throw new Error("Round already has a final result");
    this.final ??= {
      payload: JSON.stringify(result),
      key: crypto.randomUUID(),
    };
    if (this.receipt) return this.receipt;
    // Keep the same key and serialized payload on every retry, including after a lost response.
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return (this.receipt = await this.request(
          `/play-sessions/${this.session.playSessionId}/results`,
          JSON.parse(this.final.payload),
          this.final.key,
        ));
      } catch (error) {
        if (
          (error.status && error.status < 500 && error.status !== 429) ||
          attempt === 2
        )
          throw error;
        await new Promise((resolve) =>
          setTimeout(resolve, 500 * (attempt + 1)),
        );
      }
    }
  }
}

// Opt-in game UI: the game supplies the host/styles; no third-party icons, member
// credentials or automatic public publishing. Creation happens only on a click.
export function renderChallengeAction(host,client,receipt) {
  host.replaceChildren();
  if(!client)return;
  const doc=host.ownerDocument,guest=client.session?.context?.memberKindAtStart==='guest';
  if(guest){
    const copy=doc.createElement('p');copy.textContent='สมัครฟรีเพื่อร่วมอันดับ รับทองจากภารกิจ และสะสม Badge';
    const link=doc.createElement('a');const url=new URL('/sign-in',client.baseUrl);url.searchParams.set('game',client.gameId);url.searchParams.set('upgrade','1');url.searchParams.set('requireGrant','1');url.searchParams.set('returnTo',doc.defaultView.location.href);
    link.href=url.href;link.textContent='สมัครฟรีด้วย Google';host.append(copy,link);return;
  }
  const copy=doc.createElement('p');copy.textContent='ใช้สถิติที่ดีที่สุดของคุณท้าเพื่อน ลิงก์จะแสดงชื่อ รูป เกม และสถิติของคุณ';
  const button=doc.createElement('button');button.type='button';button.textContent='ท้าจากสถิติสูงสุด';
  const status=doc.createElement('p');status.setAttribute('role','status');
  const idempotencyKey=crypto.randomUUID();
  button.onclick=async()=>{
    button.disabled=true;status.textContent='กำลังสร้างคำท้า…';
    try{const challenge=await client.createBestChallenge({idempotencyKey});
      const url=new URL(challenge.url);if(url.origin!==client.baseUrl || url.pathname!=='/challenge/'+challenge.id)throw Error('Invalid challenge link');
      const input=doc.createElement('input');input.type='url';input.readOnly=true;input.value=url.href;input.setAttribute('aria-label','ลิงก์คำท้าของคุณ');
      const send=doc.createElement('button');send.type='button';send.textContent='แชร์คำท้า';send.onclick=async()=>{try{if(doc.defaultView.navigator.share)await doc.defaultView.navigator.share({title:'สถิตินี้ ใครจะแซงได้?',url:url.href});else{await doc.defaultView.navigator.clipboard.writeText(url.href);status.textContent='คัดลอกแล้ว ส่งให้เพื่อนได้เลย';}}catch(e){if(e.name!=='AbortError'){input.focus();input.select();status.textContent='คัดลอกลิงก์ด้านบนได้เลย';}}};
      host.replaceChildren(copy,input,send,status);status.textContent='เพื่อนรับคำท้าได้ภายใน 7 วัน · ส่งคำท้าฟรี ไม่มีรางวัลจากการแชร์';
    }catch(error){status.textContent=error.code==='signin_required'?'สมัครฟรีเพื่อส่งคำท้าให้เพื่อน':error.code==='best_result_unavailable'?'ยังไม่มีสถิติที่ผ่านการตรวจ เล่นจบรอบเพื่อสร้างคำท้า':error.code==='unauthorized'?'การเข้าสู่ระบบหมดอายุ กรุณาเข้าเกมอีกครั้ง':'ยังสร้างคำท้าไม่ได้ ลองใหม่อีกครั้งนะ';button.disabled=false;}
  };host.append(copy,button,status);
  if(client.session.context.challengeId){const result=doc.createElement('a');result.href=new URL('/challenge/'+client.session.context.challengeId,client.baseUrl).href;result.target='_blank';result.rel='noopener';result.textContent='ดูผลคำท้านี้';host.append(result);}
}

// Browser entry gate. Await access/beginRound BEFORE enabling controls or physics.
// A missing grant redirects to sign-in; a failed exchange never permits play.
export class GameCenterEntry {
  constructor({ baseUrl, gameId, win = window, Sdk = GameCenterGame, onError = () => {} }) {
    const url = new URL(baseUrl);
    if (url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname)))
      throw new Error("HTTPS API required");
    this.baseUrl = url.origin;
    this.gameId = gameId;
    this.win = win;
    this.Sdk = Sdk;
    this.onError = onError;
    this.started = false;
    const params = new URLSearchParams(win.location.hash.slice(1));
    const grant = params.get("gc_grant");
    if (grant) {
      params.delete("gc_grant");
      win.history.replaceState(win.history.state, "", win.location.pathname + win.location.search + (params.size ? "#" + params : ""));
    }
    this.ready = grant ? this.connect(grant) : Promise.resolve(null);
    this.ready.catch(error => onError(error));
    if (!grant) this.signIn();
  }
  signIn(resume = false) {
    const url = new URL("/sign-in", this.baseUrl);
    url.searchParams.set("game", this.gameId);
    url.searchParams.set("requireGrant", "1");
    const destination = new URL(this.win.location.href);
    const challenge=destination.searchParams.get('gc_challenge'), mode=destination.searchParams.get('gc_mode');
    if(challenge && /^[a-f0-9]{48}$/.test(challenge))url.searchParams.set('challenge',challenge);
    if(mode && /^[a-z0-9-]{1,100}$/.test(mode))url.searchParams.set('mode',mode);
    if (resume) destination.searchParams.set("gc_resume", "1");
    url.searchParams.set("returnTo", destination.href);
    this.win.location.replace(url.href);
    return null;
  }
  async connect(grant) {
    const client = new this.Sdk({ baseUrl: this.baseUrl, gameId: this.gameId, grant });
    await client.connect();
    this.client = client;
    return client;
  }
  async access() {
    await this.ready;
    const client = this.client;
    if (!client) return null;
    const expiry = client.session?.replayTokenExpiresAt || client.session?.expiresAt;
    if (expiry && Date.parse(expiry) <= Date.now())
      throw Object.assign(new Error("การเข้าสู่ระบบหมดอายุ กรุณาเข้าสู่ระบบอีกครั้ง"), { status: 401, code: "unauthorized" });
    return client;
  }
  async createBestChallenge(options) {
    const client=await this.access();
    if(!client)throw Object.assign(new Error('Sign in before creating a challenge'),{code:'unauthorized',status:401});
    return client.createBestChallenge(options);
  }
  beginRound(options = {}) {
    this.starting ??= this.startRound(options).finally(() => { this.starting = null; });
    return this.starting;
  }
  async startRound({mode} = {}) {
    if (!await this.access()) return null;
    const expired = this.client.session?.expiresAt && Date.parse(this.client.session.expiresAt) <= Date.now();
    // New servers mark lobby grants with a period ID. Start a fresh timed round
    // when controls are enabled, so waiting across a reset cannot use the old period.
    if (!this.started && !expired && !this.client.session?.context?.rankingPeriodId && (!mode || this.client.session?.context?.mode===mode)) {
      this.started = true;
      return this.client;
    }
    // Older iframe launchers can still supply grants; current clients replay directly.
    if (this.win.parent !== this.win && !this.client.session?.replayToken) {
      const grant = await this.requestGrant();
      return this.connect(grant);
    }
    if (typeof this.client.replay !== "function")
      throw new Error("สิทธิ์เปิดรอบใหม่ไม่พร้อม กรุณาเข้าเกมอีกครั้ง");
    const next = await this.client.replay(mode ? {mode} : {});
    this.client = next;
    this.started = true;
    return next;
  }
  requestGrant() {
    return new Promise((resolve, reject) => {
      const requestId = crypto.randomUUID(), win = this.win;
      const cleanup = () => { clearTimeout(timer); win.removeEventListener("message", receive); };
      const receive = event => {
        if (event.origin !== this.baseUrl || event.source !== win.parent ||
            event.data?.type !== "gc.round.grant" || event.data.requestId !== requestId) return;
        cleanup();
        typeof event.data.grant === "string" && event.data.grant
          ? resolve(event.data.grant) : reject(new Error("ไม่สามารถเริ่มรอบใหม่ได้ กรุณาเปิดเกมอีกครั้ง"));
      };
      const timer = setTimeout(() => { cleanup(); reject(new Error("เชื่อมต่อ Game Center ไม่สำเร็จ")); }, 10000);
      win.addEventListener("message", receive);
      try { win.parent.postMessage({ type: "gc.round.request", requestId }, this.baseUrl); }
      catch (error) { cleanup(); reject(error); }
    });
  }
}
