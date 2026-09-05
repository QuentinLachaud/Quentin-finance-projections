import { useEffect, useState } from 'react'
import { supabase } from './supabase.js'
import { deduplicateTransactions, mapStoredBankTransaction } from './banking.js'

export const useBankPerformanceData = (userId) => {
  const [data, setData] = useState({ transactions: [], accounts: [], available: false })
  useEffect(() => {
    let active = true
    if (!userId) { setData({ transactions: [], accounts: [], available: false }); return undefined }
    const load = async () => {
      const [accountsResult, transactionsResult] = await Promise.all([
        supabase.from('bank_accounts').select('id,currency,current_balance,include_in_cash'),
        supabase.from('bank_transactions').select('id,account_id,transaction_key,booked_at,value_at,amount,currency,description,counterparty,status,balance_after,category,is_transfer,category_overridden,source_type,property_id,performance_treatment,exclude_from_performance'),
      ])
      if (!active) return
      if (accountsResult.error || transactionsResult.error) {
        setData({ transactions: [], accounts: [], available: false })
        return
      }
      const accounts = (accountsResult.data || []).map((row) => ({
        id: row.id,
        currency: row.currency,
        currentBalance: Number(row.current_balance || 0),
        includeInCash: row.include_in_cash,
      }))
      const transactions = deduplicateTransactions((transactionsResult.data || []).map((row) => mapStoredBankTransaction(row)))
      setData({ transactions, accounts, available: accounts.length > 0 || transactions.length > 0 })
    }
    load()
    return () => { active = false }
  }, [userId])
  return data
}
