import { useEffect, useRef, useState } from 'react'
import { LOCAL_GAME_CENTER, readLeaderboard, type Leaderboard, type Submission } from '../integration/gameCenter'
import { PawIcon } from './PawIcon'

function RankingMascot({ className, sizes }: { className: string; sizes: string }) {
  return <picture>
    <source type="image/webp" srcSet="/optimized/ui/leaderboard-mascot-128.webp 128w, /optimized/ui/leaderboard-mascot-256.webp 256w, /optimized/ui/leaderboard-mascot-384.webp 384w" sizes={sizes} />
    <img className={className} src="/ui/leaderboard-mascot.png" width="384" height="384" alt="" aria-hidden="true" />
  </picture>
}

export function RankingButton({ onClick }: { onClick: () => void }) {
  return <button type="button" className="gc-button gc-ranking-button" onClick={onClick} lang="th">
    <RankingMascot className="gc-button-mascot" sizes="52px" />
    <span>ดูอันดับออนไลน์</span>
    <span className="gc-button-star" aria-hidden="true">✦</span>
  </button>
}

export function SubmissionStatus({ submission, retry }: { submission: Submission; retry: (id: number) => void }) {
  const labels = {
    sending: 'กำลังส่งผล…', error: 'ส่งผลไม่สำเร็จ', pending: 'ส่งผลแล้ว · รอตรวจสอบ',
    accepted: LOCAL_GAME_CENTER ? 'ผลทดสอบในเครื่อง · ไม่ส่งคะแนนจริง' : submission.rankingEligible ? 'รอบนี้มีสิทธิ์ขึ้นอันดับ' : 'รอบนี้ไม่มีสิทธิ์ขึ้นอันดับ',
    rejected: 'ผลไม่ผ่านการตรวจสอบ', quarantined: 'ผลถูกพักไว้เพื่อตรวจสอบ', deleted: 'ผลถูกนำออกจากระบบ',
  }
  return <div className="gc-submission" role="status">
    <span>{submission.status === 'accepted' ? labels.accepted : `ครั้งที่ ${submission.id} · ${labels[submission.status]}`}</span>
    {submission.status === 'error' && <button type="button" className="gc-button" onClick={() => retry(submission.id)}>ลองส่งอีกครั้ง</button>}
  </div>
}

function safeAvatar(url: string): string | undefined {
  try { return new URL(url).protocol === 'https:' ? url : undefined } catch { return undefined }
}

export function LeaderboardDialog({ onClose }: { onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [board, setBoard] = useState<Leaderboard | null>(null)
  const [error, setError] = useState(false)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    const element = dialog.current!
    const previousFocus = document.activeElement
    element.showModal()
    return () => {
      element.close()
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus()
    }
  }, [])
  useEffect(() => {
    const controller = new AbortController()
    setBoard(null)
    setError(false)
    void readLeaderboard(controller.signal).then(value => {
      if (!controller.signal.aborted) setBoard(value)
    }).catch(() => {
      if (!controller.signal.aborted) setError(true)
    })
    return () => controller.abort()
  }, [attempt])
  const period = board?.meta.period
  const formatDate = (value: string) => new Intl.DateTimeFormat('th-TH', {
    dateStyle: 'medium', timeStyle: 'short', timeZone: period?.timezone ?? 'Asia/Bangkok',
  }).format(new Date(value))
  return <dialog ref={dialog} className="gc-dialog" lang="th" aria-labelledby="gc-ranking-title" onCancel={event => { event.preventDefault(); onClose() }}>
    <header className="gc-dialog-header">
      <button type="button" className="gc-button gc-close" onClick={onClose} autoFocus aria-label="ปิดอันดับ"><span aria-hidden="true">×</span></button>
      <RankingMascot className="gc-header-mascot" sizes="100px" />
      <p className="gc-eyebrow" lang="en">Cat Card · Leaderboard</p>
      <h2 id="gc-ranking-title">{LOCAL_GAME_CENTER ? 'อันดับทดสอบในเครื่อง' : 'อันดับออนไลน์ Top 5'}</h2>
      <p className="gc-subtitle">คะแนนสูงสุด · โหมดปกติ</p>
    </header>
    {period && <p className="gc-period">{formatDate(period.startsAt)} – {formatDate(period.endsAt)} ({period.timezone ?? 'Asia/Bangkok'})</p>}
    {!board && !error && <div className="gc-empty" role="status"><PawIcon className="gc-empty-paw" /><p>กำลังโหลดอันดับ…</p></div>}
    {error && <div className="gc-empty" role="alert"><PawIcon className="gc-empty-paw" /><p>โหลดอันดับไม่สำเร็จ</p><button className="gc-button" type="button" onClick={() => setAttempt(value => value + 1)}>ลองโหลดอีกครั้ง</button></div>}
    {board && (board.data.length === 0 ? <div className="gc-empty" role="status"><PawIcon className="gc-empty-paw" /><p>{LOCAL_GAME_CENTER ? 'โหมดพัฒนาไม่โหลดอันดับจริง' : 'ยังไม่มีคะแนนในรอบนี้'}</p><span>กลับมาดูคะแนนกันอีกครั้งนะ</span></div> : <table className="gc-ranking">
      <caption className="gc-visually-hidden">อันดับคะแนน Cat Card จาก Game Center</caption>
      <thead><tr><th scope="col">อันดับ</th><th scope="col">ผู้เล่น</th><th scope="col">คะแนน</th></tr></thead>
      <tbody>{board.data.slice(0, 5).map(player => <tr key={player.memberId}>
        <td><span className={`gc-rank gc-rank-${player.rank}`}><span className="gc-medal" aria-hidden="true" />{player.rank}</span></td>
        <td><div className="gc-player">
          {safeAvatar(player.avatar.url) && <img src={safeAvatar(player.avatar.url)} alt="" width="32" height="32" referrerPolicy="no-referrer" />}
          {!safeAvatar(player.avatar.url) && <span className="gc-avatar-fallback" aria-hidden="true"><PawIcon /></span>}
          <span className="gc-player-copy"><span className="gc-player-name">{player.displayName}</span><span className="gc-member">{player.memberKind === 'registered' ? 'สมาชิก' : 'Guest'}</span></span>
        </div></td>
        <td>{player.score}</td>
      </tr>)}</tbody>
    </table>)}
    <p className="gc-ranking-note">สิทธิ์ขึ้นอันดับของแต่ละรอบเป็นไปตามผลตรวจจาก Game Center การรับผลสำเร็จไม่รับประกันอันดับหรือรางวัล</p>
  </dialog>
}
