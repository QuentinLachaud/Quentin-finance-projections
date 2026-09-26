import React, { useEffect, useRef, useState } from 'react'
import { ArrowRight, Check, Mic, RotateCcw, Sparkles, Square, X } from 'lucide-react'
import BrainDrainNumericInput from './BrainDrainNumericInput.jsx'
import LunaMessageContent from './LunaMessageContent.jsx'
import { safeLunaChatActions } from './lunaChatActions.js'
import {
  LUNA_GREETING,
  LUNA_HISTORY_MESSAGE_LIMIT,
  boundedLunaTurns,
  lunaConversationStorageKey,
  persistLunaTurns,
  restoreLunaTurns,
} from './lunaConversation.js'
import './LunaAssistant.css'

const assistantMessage = (text, persist = true, chatActions = []) => ({ id: crypto.randomUUID(), role: 'assistant', text, persist, chatActions })
const userMessage = (text, persist = true) => ({ id: crypto.randomUUID(), role: 'user', text, persist })
const appendMessage = (messages, message) => {
  const next = [...messages, message]
  const keep = new Set([
    ...next.filter((item) => item.persist !== false).slice(-LUNA_HISTORY_MESSAGE_LIMIT),
    ...next.slice(-LUNA_HISTORY_MESSAGE_LIMIT),
  ].map((item) => item.id))
  return next.filter((item) => keep.has(item.id))
}
const initialMessages = (userId) => {
  const restored = restoreLunaTurns(window.sessionStorage, userId)
  return restored.length
    ? restored.map((message) => ({ ...message, id: crypto.randomUUID() }))
    : [assistantMessage(LUNA_GREETING, false)]
}

export default function LunaAssistant({ accessToken, userId, onPortfolioChange, onUiActions, uiActionContext = {} }) {
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState(() => initialMessages(userId))
  const [pending, setPending] = useState(null)
  const [working, setWorking] = useState(false)
  const [recording, setRecording] = useState(false)
  const [transcribing, setTranscribing] = useState(false)
  const [voiceError, setVoiceError] = useState('')
  const recorderRef = useRef(null)
  const streamRef = useRef(null)
  const chunksRef = useRef([])
  const recordingTimerRef = useRef(null)
  const discardRecordingRef = useRef(false)

  useEffect(() => {
    persistLunaTurns(window.sessionStorage, userId, messages)
  }, [messages, userId])

  useEffect(() => () => {
    discardRecordingRef.current = true
    if (recordingTimerRef.current) window.clearTimeout(recordingTimerRef.current)
    const recorder = recorderRef.current
    if (recorder && recorder.state !== 'inactive') {
      recorder.ondataavailable = null
      recorder.onstop = null
      recorder.stop()
    }
    streamRef.current?.getTracks?.().forEach((track) => track.stop())
  }, [])

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

  const releaseMicrophone = () => {
    if (recordingTimerRef.current) {
      window.clearTimeout(recordingTimerRef.current)
      recordingTimerRef.current = null
    }
    streamRef.current?.getTracks?.().forEach((track) => track.stop())
    streamRef.current = null
  }

  const transcribeVoice = async (blob) => {
    setTranscribing(true)
    setVoiceError('')
    try {
      const form = new FormData()
      const type = String(blob.type || '').toLowerCase()
      const extension = type.includes('mp4') ? 'mp4' : type.includes('ogg') ? 'ogg' : type.includes('wav') ? 'wav' : 'webm'
      form.append('audio', blob, `luna-voice.${extension}`)
      const response = await fetch('/api/luna-transcribe', {
        method: 'POST',
        headers: { authorization: `Bearer ${accessToken}` },
        body: form,
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(result.error || 'Voice transcription failed.')
      const transcript = String(result.text || '').trim()
      if (!transcript) throw new Error('No speech was detected.')
      setInput((current) => `${current.trim()}${current.trim() ? ' ' : ''}${transcript}`.trim().slice(0, 3000))
    } catch (error) {
      setVoiceError(error.message || 'Voice transcription failed.')
    } finally {
      setTranscribing(false)
    }
  }

  const stopRecording = (discard = false) => {
    discardRecordingRef.current = discard
    const recorder = recorderRef.current
    if (recorder && recorder.state !== 'inactive') {
      recorder.stop()
      return
    }
    releaseMicrophone()
    setRecording(false)
  }

  const startRecording = async () => {
    if (recording) {
      stopRecording(false)
      return
    }
    if (working || transcribing) return
    setVoiceError('')
    if (!navigator.mediaDevices?.getUserMedia || typeof globalThis.MediaRecorder === 'undefined') {
      setVoiceError('Voice input is not supported by this browser.')
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const candidates = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm']
      const mimeType = candidates.find((type) => globalThis.MediaRecorder.isTypeSupported?.(type)) || ''
      const recorder = mimeType
        ? new globalThis.MediaRecorder(stream, { mimeType })
        : new globalThis.MediaRecorder(stream)
      recorderRef.current = recorder
      chunksRef.current = []
      discardRecordingRef.current = false

      recorder.ondataavailable = (event) => {
        if (event.data?.size) chunksRef.current.push(event.data)
      }
      recorder.onstop = () => {
        const chunks = chunksRef.current
        const discard = discardRecordingRef.current
        chunksRef.current = []
        recorderRef.current = null
        discardRecordingRef.current = false
        releaseMicrophone()
        setRecording(false)
        if (!discard && chunks.length) {
          const blob = new Blob(chunks, { type: recorder.mimeType || chunks[0]?.type || mimeType || 'audio/webm' })
          if (blob.size) void transcribeVoice(blob)
        }
      }
      recorder.start()
      setRecording(true)
      recordingTimerRef.current = window.setTimeout(() => {
        if (recorder.state !== 'inactive') stopRecording(false)
      }, 60_000)
    } catch {
      releaseMicrophone()
      recorderRef.current = null
      setRecording(false)
      setVoiceError('Microphone access was denied or unavailable.')
    }
  }

  const submit = async (event) => {
    event?.preventDefault?.()
    const text = input.trim()
    if (!text || working || recording || transcribing) return
    const history = boundedLunaTurns(messages)
    const turn = userMessage(text, false)
    setInput('')
    setMessages((current) => appendMessage(current, turn))
    setWorking(true)
    try {
      const result = await call({ message: text, history })
      setMessages((current) => appendMessage(
        current.map((message) => message.id === turn.id ? { ...message, persist: true } : message),
        assistantMessage(result.message || 'Done.', !result.confirmation, safeLunaChatActions(result.chatActions, uiActionContext)),
      ))
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
    if (recording) stopRecording(true)
    window.sessionStorage.removeItem(lunaConversationStorageKey(userId))
    setMessages([assistantMessage(LUNA_GREETING, false)])
    setPending(null)
    setInput('')
    setVoiceError('')
  }

  const closePanel = () => {
    if (recording) stopRecording(true)
    setOpen(false)
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
        <button type="button" className="luna-new-conversation" onClick={newConversation} aria-label="New conversation" disabled={working || recording || transcribing}><RotateCcw size={14} /><span>New</span></button>
        <button type="button" className="luna-close" onClick={closePanel} aria-label="Close Luna"><X size={18} /></button>
      </div>
    </header>
    <div className="luna-messages" aria-live="polite">
      {messages.slice(-10).map((message) => {
        const chatActions = message.role === 'assistant' ? safeLunaChatActions(message.chatActions, uiActionContext) : []
        return <div key={message.id} className={`luna-message ${message.role}`}>
          {message.role === 'assistant' ? <LunaMessageContent text={message.text} /> : message.text}
          {chatActions.length > 0 && <div className="luna-chat-actions" aria-label="Suggested actions">
            {chatActions.map((descriptor) => <button
              type="button"
              className="luna-chat-action"
              key={`${descriptor.label}-${JSON.stringify(descriptor.actions)}`}
              onClick={() => onUiActions?.(descriptor.actions)}
            >
              <span>{descriptor.label}</span><ArrowRight size={13} aria-hidden="true" />
            </button>)}
          </div>}
        </div>
      })}
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
      <button
        type="button"
        className={`luna-voice-button${recording ? ' recording' : ''}`}
        onClick={startRecording}
        aria-label={recording ? 'Stop voice input' : 'Start voice input'}
        aria-pressed={recording}
        title={recording ? 'Stop voice input' : 'Speak to Luna'}
        disabled={working || transcribing}
      >
        {recording ? <Square size={16} /> : <Mic size={17} />}
      </button>
      <button type="submit" className="primary-button" disabled={!input.trim() || working || recording || transcribing}>Send</button>
      {(recording || transcribing || voiceError) && <span className={`luna-voice-status${voiceError ? ' error' : ''}`} role="status">
        {voiceError || (recording ? 'Listening… tap stop when finished.' : 'Transcribing…')}
      </span>}
    </form>
  </aside>
}
