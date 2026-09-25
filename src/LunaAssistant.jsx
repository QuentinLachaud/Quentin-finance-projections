import React, { useEffect, useState } from 'react'
import { Check, RotateCcw, Sparkles, X } from 'lucide-react'
import BrainDrainNumericInput from './BrainDrainNumericInput.jsx'
import {
  LUNA_GREETING,
  LUNA_HISTORY_MESSAGE_LIMIT,
  boundedLunaTurns,
  lunaConversationStorageKey,
  persistLunaTurns,
  restoreLunaTurns,
} from './lunaConversation.js'
import './LunaAssistant.css'

const assistantMessage = (text, persist = true) => ({ id: crypto.randomUUID(), role: 'assistant', text, persist })
const userMessage = (text) => ({ id: crypto.randomUUID(), role: 'user', text })
const appendMessage = (messages, message) => [...messages, message].slice(-LUNA_HISTORY_MESSAGE_LIMIT)
const initialMessages = (userId) => {
  const restored = restoreLunaTurns(window.sessionStorage, userId)
  return restored.length
    ? restored.map((message) => ({ ...message, id: crypto.randomUUID() }))
    : [assistantMessage(LUNA_GREETING, false)]
}

export default function LunaAssistant({ accessToken, userId, onPortfolioChange, onUiActions }) {
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState(() => initialMessages(userId))
  const [pending, setPending] = useState(null)
  const [working, setWorking] = useState(false)

  useEffect(() => {
    persistLunaTurns(window.sessionStorage, userId, messages)
  }, [messages, userId])

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
    const history = boundedLunaTurns(messages)
    setInput('')
    setMessages((current) => appendMessage(current, userMessage(text)))
    setWorking(true)
    try {
      const result = await call({ message: text, history })
      setMessages((current) => appendMessage(current, assistantMessage(result.message || 'Done.', !result.confirmation)))
      setPending(result.confirmation || null)
    } catch (error) {
      setMessages((current) => appendMessage(current, assistantMessage(error.message, false)))
    } finally {
      setWorking(false)
    }
  }

  const confirm = async () => {
    if (!pending || working) return
    setWorking(true)
    try {
      const result = await call({ confirmation: pending })
      setMessages((current) => appendMessage(current, assistantMessage(result.message || 'Done.')))
      setPending(null)
    } catch (error) {
      setMessages((current) => appendMessage(current, assistantMessage(error.message, false)))
    } finally {
      setWorking(false)
    }
  }

  const newConversation = () => {
    window.sessionStorage.removeItem(lunaConversationStorageKey(userId))
    setMessages([assistantMessage(LUNA_GREETING, false)])
    setPending(null)
    setInput('')
  }

  if (!open) {
    return <button type="button" className="luna-launcher" onClick={() => setOpen(true)} aria-label="Ask Luna">
      <Sparkles size={19} /><span>Ask Luna</span>
    </button>
  }

  return <aside className="luna-panel" aria-label="Luna assistant">
    <header>
      <div className="luna-heading"><Sparkles size={18} /><strong>Luna</strong><span>Portfolio assistant</span></div>
      <div className="luna-header-actions">
        <button type="button" className="luna-new-conversation" onClick={newConversation} aria-label="New conversation" disabled={working}><RotateCcw size={14} /><span>New</span></button>
        <button type="button" onClick={() => setOpen(false)} aria-label="Close Luna"><X size={18} /></button>
      </div>
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
