"use client";
import { useEffect,useState } from 'react';
import { api,ApiError } from '@/lib/api';
import { Button,Card } from '@/components/ui';
export default function Consent(){
  const [data,setData]=useState<{name:string;scope:string;redirectUri:string}|null>(null);const [error,setError]=useState('');const [busy,setBusy]=useState(false);
  useEffect(()=>{const query=window.location.search;api<{name:string;scope:string;redirectUri:string}>(`/oidc/consent${query}`).then(setData).catch(e=>{if(e instanceof ApiError&&e.status===401)window.location.assign(`/login?next=${encodeURIComponent(window.location.pathname+query)}`);else setError(e.message);});},[]);
  async function decide(decision:string){setBusy(true);try{const result=await api<{redirect:string}>('/oidc/consent',{method:'POST',body:JSON.stringify({...Object.fromEntries(new URLSearchParams(window.location.search)),decision})});window.location.assign(result.redirect);}catch(e){setError((e as Error).message);setBusy(false);}}
  return <main className="mx-auto max-w-xl p-6 py-20"><Card><h1 className="text-2xl font-semibold">Вход через ФСП ID</h1>{error&&<p role="alert" className="my-4 text-red-700">{error}</p>}{data?<><p className="my-4">Приложение <strong>{data.name}</strong> запрашивает доступ к вашей учётной записи.</p><ul className="my-4 list-disc pl-5"><li>Идентификатор аккаунта</li>{data.scope.split(' ').includes('profile')&&<li>Фамилия, имя и отчество</li>}{data.scope.split(' ').includes('sport')&&<li>Роли, дисциплины и действующий разряд</li>}</ul><p className="my-4 break-all text-sm text-slate-500">Возврат в приложение: {data.redirectUri}</p><div className="flex gap-3"><Button disabled={busy} onClick={()=>void decide('approve')}>Разрешить вход</Button><Button variant="outline" disabled={busy} onClick={()=>void decide('deny')}>Отказать</Button></div></>:!error&&<p className="mt-4">Проверяем запрос…</p>}</Card></main>;
}
