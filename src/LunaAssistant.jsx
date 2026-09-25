import React, { useState } from 'react'
import { Check, Sparkles, X } from 'lucide-react'
import BrainDrainNumericInput from './BrainDrainNumericInput.jsx'
import './LunaAssistant.css'

const assistantMessage = (text) => ({ id: crypto.randomUUID(), role: 'assistant', text })
const userMessage = (text) => ({ id: crypto.randomUUID(), role: 'user', text })

export default function LunaAssistant({ accessToken, onPortfolioChange, onUiActions }) {
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState([
    assistantMessage('Ask me about the portfolio, or tell me what you want changed.'),
  ])
  const [pending, setPending] = useState(null)
  const [working, setWorking] = useState(false)

  const call = async (payload) => {
    const response = await fetch('/api/luna', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(payload),
    })
    const result = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(result.error || 'Luna could not complete that request.')
    if (result.portfolio) onPortfolioChange?.(result.portfolio)
    if (Array.isArray(result.uiActions) && result.uiActions.length) onUiActions?.(result.uiActions)
    return result
  }

  const submit = async (event) => {
    event?.preventDefault?.()
    const text = input.trim()
    if (!text || working) return
    setInput('')
    setMessages((current) => [...current, userMessage(text)])
    setWorking(true)
    try {
      const result = await call({ message: text })
      setMessages((current) => [...current, assistantMessage(result.message || 'Done.')])
      setPending(result.confirmation || null)
    } catch (error) {
      setMessages((current) => [...current, assistantMessage(error.message)])
    } finally {
      setWorking(false)
    }
  }

  const confirm = async () => {
    if (!pending || working) return
    setWorking(true)
    try {
      const result = await call({ confirmation: pending })
      setMessages((current) => [...current, assistantMessage(result.message || 'Done.')])
      setPending(null)
    } catch (error) {
      setMessages((current) => [...current, assistantMessage(error.message)])
    } finally {
      setWorking(false)
    }
  }

  if (!open) {
    return <button type="button" className="luna-launcher" onClick={() => setOpen(true)} aria-label="Ask Luna">
      <Sparkles size={19} /><span>Ask Luna</span>
    </button>
  }

  return <aside className="luna-panel" aria-label="Luna assistant">
    <header>
      <div><Sparkles size={18} /><strong>Luna</strong><span>Portfolio assistant</span></div>
      <button type="button" onClick={() => setOpen(false)} aria-label="Close Luna"><X size={18} /></button>
    </header>
    <div className="luna-messages" aria-live="polite">
      {messages.slice(-10).map((message) => <div key={message.id} className={`luna-message ${message.role}`}>{message.text}</div>)}
      {working && <div className="luna-message assistant muted">Working…</div>}
    </div>
    {pending && <div className="luna-confirm">
      <span>This action changes or deletes stored data.</span>
      <button type="button" className="primary-button" onClick={confirm} disabled={working}><Check size={15} /> Confirm</button>
      <button type="button" className="secondary-button" onClick={() => setPending(null)} disabled={working}>Cancel</button>
    </div>}
    <form className="luna-input" onSubmit={submit}>
      <BrainDrainNumericInput
        value={input}
        onChange={(event) => setInput(event.target.value)}
        placeholder="e.g. Add a £240 repair to BTL1 today"
        aria-label="Ask Luna"
        maxLength={3000}
      />
      <button type="submit" className="primary-button" disabled={!input.trim() || working}>Send</button>
    </form>
  </aside>
}
