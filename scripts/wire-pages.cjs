const fs=require('fs');const edit=(p,f)=>fs.writeFileSync(p,f(fs.readFileSync(p,'utf8')));
for(const [route,section] of Object.entries({training:'training',standards:'standards',appeals:'appeals','governor-awards':'awards',integrations:'integrations','judging-documents':'judging',journey:'journey'})){
const folder=`apps/web/src/app/(cabinet)/${route}`;fs.mkdirSync(folder,{recursive:true});fs.writeFileSync(`${folder}/page.tsx`,`import RegionalWorkspace from '@/features/regional/workspace';\nexport default function Page(){return <RegionalWorkspace section="${section}"/>;}\n`);
}
edit('apps/web/src/app/(cabinet)/development/page.tsx',s=>s.replace('import { Card,',`import { DevelopmentDetails } from '@/features/regional/development';\nimport { Card,`).replace('      <div className="mt-6 grid', '      <DevelopmentDetails />\n      <div className="mt-6 grid'));
edit('apps/web/src/components/public-shell.tsx',s=>s.replace('const links = [','const links = [\n  ["/public/guide", "С чего начать"],'));
edit('apps/web/src/app/(cabinet)/national-team/page.tsx',s=>s.replaceAll('disabled={busy}','disabled={busy || !canEdit}').replace('<div className="mt-5 grid gap-5 lg:grid-cols-2">','{canEdit && <div className="mt-5 grid gap-5 lg:grid-cols-2">').replace('          <details className="mt-5', '          }\n          <details className="mt-5'));
