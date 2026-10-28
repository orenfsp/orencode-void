"use client";
import { useEffect,useRef,useState } from 'react';
import { Button,Card,Field,Input } from '@/components/ui';
import { downloadUrl } from '@/lib/api';
const base64=(bytes:Uint8Array)=>btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
export default function Demo(){
  const started=useRef(false);
  const [client,setClient]=useState('');const [error,setError]=useState('');const [profile,setProfile]=useState<Record<string,unknown>|null>(null);
  useEffect(()=>{if(started.current)return;started.current=true;const params=new URLSearchParams(window.location.search);setClient(params.get('client')??'');if(!params.has('code')&&!params.has('error'))return;
    const saved=sessionStorage.getItem('fsp-oidc-demo');sessionStorage.removeItem('fsp-oidc-demo');if(!saved){setError('Запрос входа не найден. Начните заново.');return;}
    const flow=JSON.parse(saved);setClient(flow.client);if(params.get('state')!==flow.state){setError('Проверка state не пройдена');return;}if(params.has('error')){setError('Пользователь отказал в доступе');return;}
    window.history.replaceState({},'',window.location.pathname);
    void (async()=>{try{
      const issuer=downloadUrl('/oidc');const response=await fetch(`${issuer}/token`,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'authorization_code',client_id:flow.client,redirect_uri:flow.redirect,code:params.get('code')!,code_verifier:flow.verifier})});
      const token=await response.json();if(!response.ok)throw new Error(token.error??'Ошибка обмена кода');
      const parts=token.id_token.split('.');const decode=(s:string)=>Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));const header=JSON.parse(new TextDecoder().decode(decode(parts[0])));const claims=JSON.parse(new TextDecoder().decode(decode(parts[1])));
      const discovery=await (await fetch(`${issuer}/.well-known/openid-configuration`)).json();const jwks=await (await fetch(discovery.jwks_uri)).json();const jwk=jwks.keys.find((k:{kid:string})=>k.kid===header.kid);if(header.alg!=='RS256'||!jwk)throw new Error('Неизвестный ключ подписи');
      const key=await crypto.subtle.importKey('jwk',jwk,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['verify']);const valid=await crypto.subtle.verify('RSASSA-PKCS1-v1_5',key,decode(parts[2]),new TextEncoder().encode(`${parts[0]}.${parts[1]}`));
      if(!valid||claims.nonce!==flow.nonce||claims.aud!==flow.client||claims.iss!==discovery.issuer||claims.exp<=Date.now()/1000)throw new Error('ID-токен не прошёл проверку');
      const info=await fetch(`${issuer}/userinfo`,{headers:{Authorization:`Bearer ${token.access_token}`}});if(!info.ok)throw new Error('Ошибка userinfo');const user=await info.json();if(user.sub!==claims.sub)throw new Error('Идентификатор пользователя не совпал');setProfile(user);
    }catch(e){setError((e as Error).message);}})();
  },[]);
  async function login(){try{setError('');const verifier=base64(crypto.getRandomValues(new Uint8Array(48)));const state=base64(crypto.getRandomValues(new Uint8Array(24)));const nonce=base64(crypto.getRandomValues(new Uint8Array(24)));const redirect=window.location.origin+'/fsp-demo';const challenge=base64(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier))));sessionStorage.setItem('fsp-oidc-demo',JSON.stringify({client,verifier,state,nonce,redirect}));window.location.assign(downloadUrl('/oidc/authorize')+'?'+new URLSearchParams({client_id:client,redirect_uri:redirect,response_type:'code',code_challenge_method:'S256',code_challenge:challenge,state,nonce,scope:'openid profile sport'}));}catch(e){setError((e as Error).message);}}
  return <main className="mx-auto max-w-xl p-6 py-16"><Card><h1 className="text-2xl font-semibold">Тестовый сервис партнёра</h1><p className="my-4">Проверка входа через ФСП ID. Зарегистрируйте клиент с адресом возврата «адрес этого сайта/fsp-demo».</p><Field label="Client ID"><Input value={client} onChange={e=>setClient(e.target.value)}/></Field><Button className="mt-4" disabled={!client} onClick={()=>void login()}>Войти через ФСП ID</Button>{error&&<p role="alert" className="my-4 text-red-700">{error}</p>}{profile&&<div className="mt-4"><h2 className="font-semibold">Вход подтверждён</h2><pre className="overflow-auto whitespace-pre-wrap break-all text-sm">{JSON.stringify(profile,null,2)}</pre></div>}</Card></main>;
}
