import chap from './src/routes/chapels.routes.js';
import mem from './src/routes/members.routes.js';

const r1 = chap, r2 = mem;
console.log('chapels stack length', r1.stack?.length);
r1.stack?.forEach((l,i)=> console.log(i, l.route ? `${Object.keys(l.route.methods).join(',')} ${l.route.path}` : `<mw ${l.name}>`));
console.log('\nmembers stack length', r2.stack?.length);
r2.stack?.forEach((l,i)=> console.log(i, l.route ? `${Object.keys(l.route.methods).join(',')} ${l.route.path}` : `<mw ${l.name}>`));
