import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from '../../node_modules/.pnpm/node_modules/sharp/lib/index.js';

const root = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(root, 'images');
await fs.mkdir(out, { recursive: true });
const ink = '#1e302b';
const muted = '#62716b';
const green = '#2b7158';
const esc = (v) => v.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const text = (x, y, value, size = 34, color = ink, weight = 400) => `<text x="${x}" y="${y}" fill="${color}" font-size="${size}" font-weight="${weight}">${esc(value)}</text>`;
const lines = (x, y, values, size = 34, color = ink, weight = 400, leading = 56) => values.map((v,i)=>text(x,y+i*leading,v,size,color,weight)).join('');
const box = (x,y,w,h,fill='#ffffff',r=24) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}"/>`;
const img = async(name,x,y,w,h) => {
 const crops = {'html.png':{left:330,top:485,width:1110,height:280},'zip.png':{left:330,top:485,width:1110,height:220},'home.png':{left:280,top:166,width:975,height:258},'create.png':{left:420,top:168,width:700,height:393},'deploy.png':{left:280,top:254,width:975,height:427},'public-url.png':{left:280,top:80,width:975,height:310}};
 const source = sharp(path.join(root,'assets',name === 'live.png' ? name : ['html.png','zip.png'].includes(name) ? name.replace('.png','-full.png') : name.replace('.png','-full.jpg')));
 const bytes = await (crops[name] ? source.extract(crops[name]) : source).png().toBuffer();
 return `<image xlink:href="data:image/png;base64,${bytes.toString('base64')}" x="${x}" y="${y}" width="${w}" height="${h}" preserveAspectRatio="xMidYMid meet"/>`;
};
const header = (n,tag,title,sub) => box(0,0,1080,1440,'#f5f4ed',0)+text(64,82,tag,24,green,600)+text(934,82,`${String(n).padStart(2,'0')} / 10`,22,muted)+lines(64,192,title,64,ink,700,86)+text(64,355,sub,29,muted);
const foot = (v) => `<path d="M64 1330H1016" stroke="#d6ddd2"/>`+text(64,1377,v,23,muted)+text(925,1377,'→',34,green);
const badge = (x,y,label) => box(x,y,210,52,'#deeadc',12)+text(x+20,y+36,label,25,green,600);
const slides=[];
slides.push(header(1,'AI 写网页',['网页写好了','怎么发给朋友看？'],'地址还是 localhost:5173？')+
 box(64,425,952,310,ink)+text(105,490,'你电脑上的预览',28,'#b9c9bb')+text(105,577,'localhost:5173',64,'#ffffff',600)+text(105,669,'复制这个地址，对方访问的是他自己的电脑。',30,'#cbd6cd')+
 text(493,817,'↓',64,green)+box(64,865,952,278,'#deeadc')+text(105,932,'部署以后',28,green)+text(105,1013,'发一个链接就能看',53,ink,700)+text(105,1083,'下面从最简单的 HTML 说起。',32,muted)+foot('HTML / ZIP / GitHub，按你手里的文件来'));
slides.push(header(2,'不知道怎么准备文件？',['把这段话','发给写代码的 AI'],'记得把项目文件一起给它')+
 box(64,422,952,572,ink)+lines(104,499,['请检查这个项目，告诉我：','','01  最后交付的是 HTML、ZIP，','      还是 GitHub 仓库？','','02  需不需要构建？','      构建命令和输出目录是什么？','','03  有没有必须运行的后端，','      或需要保密的 API Key？'],34,'#f4f7ef',400,47)+
 badge(64,1051,'看完回答再选')+lines(64,1160,['只有一份 HTML，就看第 5 张。','有其他文件的，先问清楚怎么打包。'],34)+foot('如果项目带后端，也让它说明后端要放在哪里'));
slides.push(header(3,'工具与入口',['把网页变成','可分享的网址'],'下面用 GemiGo 演示，不需要先准备 GitHub 仓库')+
 box(64,415,952,238,ink)+text(102,482,'本篇使用的网页部署工具',28,'#b9c9bb')+text(102,555,'GemiGo',58,'#fff',700)+text(102,614,'浏览器地址栏输入：gemigo.io',35,'#fff',500)+
 lines(80,761,['01  HTML   →  AI 给你一整段网页代码','02  ZIP       →  手里已有项目压缩包','03  GitHub →  代码已经放在仓库里'],37,ink,500,130)+
 box(64,1148,952,114,'#deeadc')+text(96,1218,'按手里的文件选一种，不用三种都做。',33,green,600)+foot('GemiGo · gemigo.io｜先建项目，再按来源选择入口'));
slides.push(header(4,'先建一个项目',['点「新建项目」','填个名字'],'已经建过的项目，直接打开就行')+
 box(48,421,984,578)+await img('create.png',72,444,936,524)+
 badge(64,1054,'建好后')+lines(64,1163,['打开项目里的「部署」。','接下来三种方式，选你用得上的那种。'],34)+foot('以后改了网页，还在这个项目里更新'));
slides.push(header(5,'来源 01 · HTML 优先',['AI 给了一段 HTML？','直接粘贴完整代码'],'项目 → 部署 → 内联 HTML')+
 box(48,425,984,385)+await img('html.png',64,476,952,260)+
 badge(64,870,'粘贴到这个框')+lines(64,976,['复制完整 HTML，也可以导入 .html 文件。','放进去以后，点「部署」。','如果图片、CSS、JS 是单独的文件，','也要准备好，不能只复制一段组件代码。'],33,ink,400,70)+foot('GemiGo · gemigo.io'));
slides.push(header(6,'来源 02 · ZIP',['已经拿到压缩包？','上传 ZIP 文件'],'项目 → 部署 → 上传压缩包')+
 box(48,425,984,365)+await img('zip.png',64,473,952,230)+
 badge(64,865,'点框内选文件')+lines(64,968,['选好 ZIP，上传后点「部署」。','打包时别漏掉图片和样式文件。','不知道该压缩源码还是构建后的文件？','把这个问题连同项目一起问 AI。'],33,ink,400,70)+foot('GemiGo · gemigo.io'));
slides.push(header(7,'来源 03 · GitHub',['已经有仓库了？','再选 GitHub 入口'],'项目 → 部署 → GitHub 仓库；现有项目配置示例')+
 box(48,420,984,504)+await img('deploy.png',64,447,952,425)+
 badge(64,978,'填自己的仓库')+lines(64,1086,['填仓库地址，保存，再点「部署」。','报错的话，把错误信息发给 AI 看。','这里用已有的「Github 小岛」举例。'],34,ink,400,67)+foot('没用 GitHub 的可以跳过这一张'));
slides.push(header(8,'部署完成后',['链接在「通用」里','点「复制链接」'],'找页面上的「公开 URL」')+
 box(48,428,984,380)+await img('public-url.png',63,459,954,306)+
 box(64,880,952,335,ink)+text(102,950,'别复制错了',31,'#b9c9bb')+text(102,1029,'后台地址留给自己管理',39,'#fff',600)+text(102,1112,'公开链接才是发给朋友的',39,'#fff',600)+foot('复制后，打开看看是不是你要分享的网页'));
slides.push(header(9,'打开链接看看',['朋友点开后','看到的就是网页了'],'图里是「Github 小岛」的公开页面')+
 box(48,418,984,576)+await img('live.png',65,436,950,535)+
 badge(64,1044,'一个页面例子')+lines(64,1154,['这个公开链接已经能打开。','图中的内容是演示数据。'],32)+foot('你自己的页面，也拿手机打开一次试试'));
slides.push(header(10,'发给朋友之前',['拿手机打开一下','顺手检查这几项'],'尤其看看图片有没有丢，按钮能不能点')+
 box(64,425,952,617)+lines(108,509,['□  地址不是 localhost 或项目后台','□  用未登录窗口再打开一次','□  检查图片、字体和手机排版','□  刷新页面，再点主要按钮','□  检查接口、登录和数据读写','□  确认前端没有暴露私密密钥'],35,ink,400,93)+
 box(64,1092,952,159,'#deeadc')+lines(100,1153,['图里用的是 GemiGo','浏览器打开 gemigo.io 就能找到。'],32,green,600,53)+foot('有登录、数据库或支付的，记得把这些也测一遍'));
for (const [i,body] of slides.entries()) {
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="1080" height="1440" viewBox="0 0 1080 1440"><g font-family="PingFang SC, Noto Sans CJK SC, sans-serif">${body}</g></svg>`;
 const name=String(i+1).padStart(2,'0');
 await fs.writeFile(path.join(out,`${name}.svg`),svg);
 await sharp(Buffer.from(svg)).png().toFile(path.join(out,`${name}.png`));
}
const tiles=await Promise.all(slides.map(async(_,i)=>({input:await sharp(path.join(out,`${String(i+1).padStart(2,'0')}.png`)).resize(270,360).toBuffer(),left:(i%4)*280,top:Math.floor(i/4)*370})));
await sharp({create:{width:1110,height:1100,channels:3,background:'#dddcd4'}}).composite(tiles).png().toFile(path.join(root,'contact-sheet.png'));
console.log('Rendered 10 slides and contact sheet');
