import { useEffect, useRef, useState } from 'react'
import { readLeaderboard, type Leaderboard, type Submission } from '../integration/gameCenter'

export function RankingButton({ onClick }: { onClick: () => void }) {
  return <button type="button" className="gc-button gc-ranking-button" onClick={onClick} lang="th">
    <svg className="gc-trophy" viewBox="0 0 32 32" aria-hidden="true">
      <path d="M9 5H4v5c0 5 4 7 8 7M23 5h5v5c0 5-4 7-8 7" fill="none" stroke="#bc741e" strokeWidth="3" strokeLinejoin="round" />
      <path d="M8 3h16v8c0 6-3 9-8 9s-8-3-8-9Z" fill="#ffd46b" stroke="#bc741e" strokeWidth="2" />
      <path d="M12 6h2v7h-2Z" fill="#fff4c8" />
      <path d="M16 20v6m-6 3h12l-2-3h-8Z" fill="#ffd46b" stroke="#bc741e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
    <span>ดูอันดับออนไลน์</span>
  </button>
}

export function SubmissionStatus({ submission, retry }: { submission: Submission; retry: (id: number) => void }) {
  const labels = {
    sending: 'กำลังส่งผล…', error: 'ส่งผลไม่สำเร็จ', pending: 'ส่งผลแล้ว · รอตรวจสอบ',
    accepted: submission.rankingEligible ? 'รอบนี้มีสิทธิ์ขึ้นอันดับ' : 'รอบนี้ไม่มีสิทธิ์ขึ้นอันดับ',
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
  return <dialog ref={dialog} className="gc-dialog" aria-labelledby="gc-ranking-title" onCancel={event => { event.preventDefault(); onClose() }}>
    <header className="gc-dialog-header">
      <h2 id="gc-ranking-title">อันดับออนไลน์ Top 5</h2>
      <button type="button" className="gc-button" onClick={onClose} autoFocus aria-label="ปิดอันดับ">ปิด</button>
    </header>
    <p>คะแนนสูงสุด · โหมดปกติ</p>
    {period && <p className="gc-period">{formatDate(period.startsAt)} – {formatDate(period.endsAt)} ({period.timezone ?? 'Asia/Bangkok'})</p>}
    {!board && !error && <p role="status">กำลังโหลดอันดับ…</p>}
    {error && <div role="alert"><p>โหลดอันดับไม่สำเร็จ</p><button className="gc-button" type="button" onClick={() => setAttempt(value => value + 1)}>ลองโหลดอีกครั้ง</button></div>}
    {board && (board.data.length === 0 ? <p role="status">ยังไม่มีคะแนนในรอบนี้</p> : <table className="gc-ranking">
      <caption className="gc-visually-hidden">อันดับคะแนน Cat Card จาก Game Center</caption>
      <thead><tr><th scope="col">อันดับ</th><th scope="col">ผู้เล่น</th><th scope="col">คะแนน</th></tr></thead>
      <tbody>{board.data.slice(0, 5).map(player => <tr key={player.memberId}>
        <td><span className={`gc-rank gc-rank-${player.rank}`}><span className="gc-medal" aria-hidden="true" />{player.rank}</span></td>
        <td><div className="gc-player">
          {safeAvatar(player.avatar.url) && <img src={safeAvatar(player.avatar.url)} alt="" width="32" height="32" referrerPolicy="no-referrer" />}
          <span className="gc-player-copy"><span className="gc-player-name">{player.displayName}</span><span className="gc-member">{player.memberKind === 'registered' ? 'สมาชิก' : 'Guest'}</span></span>
        </div></td>
        <td>{player.score}</td>
      </tr>)}</tbody>
    </table>)}
    <p className="gc-ranking-note">สิทธิ์ขึ้นอันดับของแต่ละรอบเป็นไปตามผลตรวจจาก Game Center การรับผลสำเร็จไม่รับประกันอันดับหรือรางวัล</p>
  </dialog>
}
