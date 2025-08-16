// app/api/orders/route.ts
import { NextResponse } from 'next/server';
import { google } from 'googleapis';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Item = { name: string; qty: number; price: number };
type Body = {
  location: string;               // เช่น 'FLAGSHIP' | 'SINDHORN' | 'CHIN3'
  billNo?: string;                // เลขบิล (ถ้ามี)
  payment: 'cash' | 'promptpay';
  items: Item[];
  total: number;
};

// สาขาที่อนุญาต
const ALLOWED_TABS = new Set(['FLAGSHIP', 'SINDHORN', 'CHIN3', 'ORDERS']);

function formatInBangkok(now: Date) {
  const tz = 'Asia/Bangkok';
  const date = new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(now); // YYYY-MM-DD
  const time = new Intl.DateTimeFormat('th-TH', {
    timeZone: tz, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  }).format(now); // HH:MM:SS
  return { date, time };
}

function
