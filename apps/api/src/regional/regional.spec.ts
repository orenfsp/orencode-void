import 'reflect-metadata';
import { describe,it,expect } from 'vitest';
import { meetsStandard } from './regional.service';
import { pkce,validateRedirect } from './oidc.controller';
import { bestAwards } from './awards.controller';
import { publicIPv4 } from './integrations.controller';
describe('Regional business and security rules',()=>{
  it('compares inclusive thresholds in both directions',()=>{expect(meetsStandard(120,120,'GTE')).toBe(true);expect(meetsStandard(119,120,'GTE')).toBe(false);expect(meetsStandard(9,9,'LTE')).toBe(true);expect(meetsStandard(10,9,'LTE')).toBe(false);expect(()=>meetsStandard(NaN,9,'GTE')).toThrow();});
  it('matches the RFC 7636 S256 test vector',()=>{expect(pkce('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk')).toBe('E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM');});
  it('rejects unsafe redirect URIs',()=>{for(const uri of ['http://example.com/cb','https://x.example/cb#fragment','https://user:password@example.com/cb','javascript:alert(1)'])expect(()=>validateRedirect(uri)).toThrow();expect(validateRedirect('http://localhost:3000/fsp-demo').hostname).toBe('localhost');});
  it('selects one maximum award per athlete, not the sum of podiums',()=>{expect(bestAwards([{athleteId:'a',amount:100},{athleteId:'b',amount:50},{athleteId:'a',amount:200}])).toEqual([{athleteId:'a',amount:200},{athleteId:'b',amount:50}]);});
  it('blocks private and link-local webhook IPs',()=>{for(const ip of ['127.0.0.1','10.0.0.1','172.16.0.1','192.168.1.2','169.254.169.254','100.64.0.1','::1','224.0.0.1'])expect(publicIPv4(ip)).toBe(false);expect(publicIPv4('8.8.8.8')).toBe(true);});
});
