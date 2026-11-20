const DAY=864e5,LOAN_DAYS=1,MAX_LOANS=3,MAX_RENEW=2,RATE=10.00;
const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let db,me=null,view='catalog',q='',filt='all',subj='',atab='books',editId=null;
const seed=()=>({off:0,nid:100,
users:[{id:1,name:'Admin',email:'admin@lib.test',pw:'admin123',role:'admin'},{id:2,name:'Demo Member',email:'member@lib.test',pw:'member123',role:'member'}],
books:[['Dune','Frank Herbert','Science Fiction','9780441013593',3],['Pride and Prejudice','Jane Austen','Classic','9780141439518',2],['Clean Code','Robert C. Martin','Programming','9780132350884',2],['Sapiens','Yuval Noah Harari','History','9780062316110',1],['The Hobbit','J.R.R. Tolkien','Fantasy','9780547928227',3],['1984','George Orwell','Dystopia','9780451524935',2],['A Brief History of Time','Stephen Hawking','Science','9780553380163',1],['The Pragmatic Programmer','Andrew Hunt','Programming','9780135957059',2],['To Kill a Mockingbird','Harper Lee','Classic','9780061120084',2],['Atomic Habits','James Clear','Self-Help','9780735211292',2],['Educated','Tara Westover','Memoir','9780399590504',1],['Cosmos','Carl Sagan','Science','9780345539434',1]].map((b,i)=>({id:i+1,title:b[0],author:b[1],subject:b[2],isbn:b[3],copies:b[4]})),
loans:[],holds:[]});
function load(){try{db=JSON.parse(localStorage.getItem('lib1'))}catch(e){}if(!db)db=seed();try{const s=localStorage.getItem('lib1s');if(s)me=db.users.find(u=>u.id==s)||null}catch(e){}}
function save(){try{localStorage.setItem('lib1',JSON.stringify(db));localStorage.setItem('lib1s',me?me.id:'')}catch(e){}}
const now=()=>Date.now()+db.off*DAY,fd=t=>new Date(t).toLocaleDateString(),money=n=>'₱'+n.toFixed(2);
const nid=()=>++db.nid;
const active=b=>db.loans.filter(l=>l.bookId==b&&!l.ret);
const avail=b=>b.copies-active(b.id).length;
const bk=id=>db.books.find(b=>b.id==id);
const usr=id=>db.users.find(u=>u.id==id);
const fineOf=l=>l.ret?(l.fine||0):Math.max(0,Math.floor((now()-l.due)/DAY))*RATE;
const owed=uid=>db.loans.filter(l=>l.userId==uid&&!l.paid).reduce((s,l)=>s+fineOf(l),0);
function toast(m){const t=$('#toast');t.textContent=m;t.className='on';clearTimeout(toast.t);toast.t=setTimeout(()=>t.className='',2400)}

/* circulation */
function borrow(id){const b=bk(id),mine=db.loans.filter(l=>l.userId==me.id&&!l.ret);
 if(mine.length>=MAX_LOANS)return toast('Loan limit reached ('+MAX_LOANS+')');
 if(owed(me.id)>=5)return toast('Please pay your fines first');
 if(mine.some(l=>l.bookId==id))return toast('You already have this book');
 const others=db.holds.filter(h=>h.bookId==id&&h.userId!=me.id).length;
 if(avail(b)-others<=0)return toast('No copy free for you — place a hold');
 db.holds=db.holds.filter(h=>!(h.bookId==id&&h.userId==me.id));
 db.loans.push({id:nid(),bookId:id,userId:me.id,out:now(),due:now()+LOAN_DAYS*DAY,ret:null,renewals:0,fine:0,paid:false});
 save();toast('Borrowed — due '+fd(now()+LOAN_DAYS*DAY));render()}
function hold(id){if(db.holds.some(h=>h.bookId==id&&h.userId==me.id))return toast('Already on hold');
 if(db.loans.some(l=>l.bookId==id&&l.userId==me.id&&!l.ret))return toast('You have this book');
 db.holds.push({id:nid(),bookId:id,userId:me.id,at:now()});save();toast('Hold placed');render()}
function giveBack(id){const l=db.loans.find(x=>x.id==id);l.fine=fineOf(l);l.ret=now();l.paid=l.fine==0;save();toast(l.fine?'Returned — fine '+money(l.fine):'Returned');render()}
function renew(id){const l=db.loans.find(x=>x.id==id);
 if(l.renewals>=MAX_RENEW)return toast('Renewal limit reached');
 if(now()>l.due)return toast('Overdue items can’t be renewed');
 if(db.holds.some(h=>h.bookId==l.bookId&&h.userId!=l.userId))return toast('Another member is waiting');
 l.due+=LOAN_DAYS*DAY;l.renewals++;save();toast('Renewed — due '+fd(l.due));render()}
function pay(){db.loans.filter(l=>l.userId==me.id&&l.ret&&!l.paid).forEach(l=>l.paid=true);save();toast('Fines paid');render()}

/* views */
function authView(){return `<div class="card auth"><h2 id="at">Sign in</h2>
<input id="nm" placeholder="Full name" style="display:none"><input id="em" type="email" placeholder="Email"><input id="pw" type="password" placeholder="Password">
<div class="acts"><button data-a="login">Sign in</button><button class="g" data-a="reg">Create account</button></div>
<p class="mu">Demo: admin@lib.test / admin123 · member@lib.test / member123</p></div>`}
function bookCard(b){const a=avail(b),h=db.holds.filter(x=>x.bookId==b.id).length,mine=me&&db.loans.some(l=>l.bookId==b.id&&l.userId==me.id&&!l.ret);
 return `<div class="card bk"><h3>${esc(b.title)}</h3><div class="mu">${esc(b.author)} · ISBN ${esc(b.isbn)}</div>
<div><span class="tag">${esc(b.subject)}</span> <span class="${a>0?'ok':'bad'}">${a>0?a+' of '+b.copies+' available':'All out'}</span>${h?` <span class="mu">· ${h} on hold</span>`:''}</div>
<div class="acts">${mine?'<span class="mu">On loan to you</span>':a>0?`<button data-a="borrow" data-id="${b.id}">Borrow</button>`:`<button class="g" data-a="hold" data-id="${b.id}">Place hold</button>`}</div></div>`}
function catalog(){const subs=[...new Set(db.books.map(b=>b.subject))].sort();
 return `<h2>Catalog</h2><div class="row"><input id="q" placeholder="Search title, author, subject or ISBN" value="${esc(q)}">
<select id="sj"><option value="">All subjects</option>${subs.map(s=>`<option ${s==subj?'selected':''}>${esc(s)}</option>`).join('')}</select>
<select id="ft"><option value="all">All items</option><option value="av" ${filt=='av'?'selected':''}>Available now</option></select></div><div class="grid" id="res"></div>`}
function list(){const t=q.toLowerCase(),r=db.books.filter(b=>(!subj||b.subject==subj)&&(filt!='av'||avail(b)>0)&&(!t||[b.title,b.author,b.subject,b.isbn].some(x=>x.toLowerCase().includes(t))));
 $('#res').innerHTML=r.map(bookCard).join('')||'<p class="mu">No books match your search.</p>'}
function account(){const L=db.loans.filter(l=>l.userId==me.id),cur=L.filter(l=>!l.ret),H=db.holds.filter(h=>h.userId==me.id),o=owed(me.id),paidable=L.some(l=>l.ret&&!l.paid);
 return `<h2>My account</h2><div class="card"><b>${esc(me.name)}</b> <span class="mu">${esc(me.email)}</span><br>Fines owed: <b class="${o>0?'bad':''}">${money(o)}</b> ${paidable?'<button data-a="pay">Pay returned-item fines</button>':''}
<div class="mu">Loan period ${LOAN_DAYS} days · ${money(RATE)}/day overdue · max ${MAX_LOANS} loans</div></div>
<h2>Current loans</h2>${cur.map(l=>{const od=now()>l.due;return `<div class="card"><b>${esc(bk(l.bookId).title)}</b><div class="mu">Due ${fd(l.due)} · renewed ${l.renewals}/${MAX_RENEW}</div>${od?`<div class="bad">Overdue — fine so far ${money(fineOf(l))}</div>`:''}
<div class="acts"><button data-a="renew" data-id="${l.id}">Renew</button><button class="g" data-a="ret" data-id="${l.id}">Return</button></div></div>`}).join('')||'<p class="mu">Nothing borrowed.</p>'}
<h2>Holds</h2>${H.map(h=>`<div class="card">${esc(bk(h.bookId).title)} <button class="d" data-a="unhold" data-id="${h.id}">Cancel</button> ${avail(bk(h.bookId))>0?'<span class="ok">· a copy is free — borrow it from the catalog</span>':''}</div>`).join('')||'<p class="mu">No holds.</p>'}
<h2>History</h2><div class="tw"><table><tr><th>Book</th><th>Borrowed</th><th>Returned</th><th>Fine</th></tr>${L.filter(l=>l.ret).map(l=>`<tr><td>${esc(bk(l.bookId).title)}</td><td>${fd(l.out)}</td><td>${fd(l.ret)}</td><td>${money(l.fine)}${l.fine&&!l.paid?' (unpaid)':''}</td></tr>`).join('')||'<tr><td colspan="4" class="mu">No history yet</td></tr>'}</table></div>`}
function admin(){const tabs=['books','members','loans','reports'];
 let h=`<h2>Admin</h2><div class="acts" style="margin-bottom:12px">${tabs.map(t=>`<button class="${t==atab?'':'g'}" data-a="tab" data-t="${t}">${t[0].toUpperCase()+t.slice(1)}</button>`).join('')}</div>`;
 if(atab=='books'){const e=editId&&bk(editId)||{};
  h+=`<form class="card" id="bf"><b>${e.id?'Edit book':'Add book'}</b><div class="row" style="margin-top:8px"><input name="title" placeholder="Title" required value="${esc(e.title)}"><input name="author" placeholder="Author" required value="${esc(e.author)}"><input name="subject" placeholder="Subject" required value="${esc(e.subject)}"><input name="isbn" placeholder="ISBN" required value="${esc(e.isbn)}"><input name="copies" type="number" min="1" placeholder="Copies" required value="${esc(e.copies||1)}"></div><button>${e.id?'Save':'Add'}</button> ${e.id?'<button type="button" class="g" data-a="canc">Cancel</button>':''}</form>
<div class="tw"><table><tr><th>Title</th><th>Author</th><th>ISBN</th><th>Copies</th><th></th></tr>${db.books.map(b=>`<tr><td>${esc(b.title)}</td><td>${esc(b.author)}</td><td>${esc(b.isbn)}</td><td>${avail(b)}/${b.copies}</td><td><button class="g" data-a="edit" data-id="${b.id}">Edit</button> <button class="d" data-a="del" data-id="${b.id}">Delete</button></td></tr>`).join('')}</table></div>`}
 if(atab=='members')h+=`<div class="tw"><table><tr><th>Name</th><th>Email</th><th>Role</th><th>Loans</th><th>Fines</th><th></th></tr>${db.users.map(u=>`<tr><td>${esc(u.name)}</td><td>${esc(u.email)}</td><td>${u.role}</td><td>${db.loans.filter(l=>l.userId==u.id&&!l.ret).length}</td><td>${money(owed(u.id))}</td><td>${u.id==me.id?'':`<button class="g" data-a="role" data-id="${u.id}">Make ${u.role=='admin'?'member':'admin'}</button> <button class="d" data-a="rmu" data-id="${u.id}">Remove</button>`}</td></tr>`).join('')}</table></div>`;
 if(atab=='loans')h+=`<div class="tw"><table><tr><th>Book</th><th>Member</th><th>Due</th><th>Status</th><th></th></tr>${db.loans.filter(l=>!l.ret).map(l=>`<tr><td>${esc(bk(l.bookId).title)}</td><td>${esc(usr(l.userId)?.name)}</td><td>${fd(l.due)}</td><td class="${now()>l.due?'bad':''}">${now()>l.due?'Overdue '+money(fineOf(l)):'On loan'}</td><td><button class="g" data-a="ret" data-id="${l.id}">Check in</button></td></tr>`).join('')||'<tr><td colspan="5" class="mu">No active loans</td></tr>'}</table></div>`;
 if(atab=='reports'){const act=db.loans.filter(l=>!l.ret),cnt={};db.loans.forEach(l=>cnt[l.bookId]=(cnt[l.bookId]||0)+1);
  const top=Object.entries(cnt).sort((a,b)=>b[1]-a[1]).slice(0,5);
  h+=`<div class="stats">${[['Titles',db.books.length],['Copies',db.books.reduce((s,b)=>s+b.copies,0)],['Active loans',act.length],['Overdue',act.filter(l=>now()>l.due).length],['Members',db.users.length],['Open holds',db.holds.length],['Fines owed',money(db.users.reduce((s,u)=>s+owed(u.id),0))]].map(x=>`<div class="card"><b>${x[1]}</b>${x[0]}</div>`).join('')}</div>
<div class="card"><b>Most borrowed</b>${top.map(t=>`<div>${esc(bk(t[0])?.title)} — ${t[1]}</div>`).join('')||'<div class="mu">No data yet</div>'}</div>
<div class="card"><b>Demo tools</b><div class="mu">Simulated date: ${fd(now())}</div><div class="acts"><button data-a="skip">Skip ahead 7 days</button><button class="g" data-a="reset">Reset all data</button></div></div>`}
 return h}
function render(){
 $('#nav').innerHTML=me?`<button class="${view=='catalog'?'on':''}" data-a="v" data-t="catalog">Catalog</button><button class="${view=='account'?'on':''}" data-a="v" data-t="account">My account</button>${me.role=='admin'?`<button class="${view=='admin'?'on':''}" data-a="v" data-t="admin">Admin</button>`:''}<button data-a="out">Sign out</button>`:'';
 $('#app').innerHTML=!me?authView():view=='account'?account():view=='admin'&&me.role=='admin'?admin():catalog();
 if(me&&$('#res'))list()}

/* events */
document.addEventListener('click',e=>{const t=e.target.closest('[data-a]');if(!t)return;const a=t.dataset.a,id=+t.dataset.id;
 if(a=='login'){const u=db.users.find(u=>u.email==$('#em').value.trim().toLowerCase()&&u.pw==$('#pw').value);if(!u)return toast('Wrong email or password');me=u;view='catalog';save();render()}
 else if(a=='reg'){const nm=$('#nm');if(nm.style.display=='none'){nm.style.display='';$('#at').textContent='Create account';return}
  const em=$('#em').value.trim().toLowerCase(),pw=$('#pw').value,n=nm.value.trim();
  if(!n||!em.includes('@')||pw.length<6)return toast('Enter name, valid email, 6+ char password');
  if(db.users.some(u=>u.email==em))return toast('Email already registered');
  me={id:nid(),name:n,email:em,pw,role:'member'};db.users.push(me);view='catalog';save();render()}
 else if(a=='out'){me=null;save();render()}
 else if(a=='v'){view=t.dataset.t;render()}
 else if(a=='borrow')borrow(id);else if(a=='hold')hold(id);else if(a=='ret'){if(!me||me.role!=='admin')return toast('Only admins can check in books');giveBack(id)}else if(a=='renew')renew(id);else if(a=='pay')pay();
 else if(a=='unhold'){db.holds=db.holds.filter(h=>h.id!=id);save();render()}
 else if(a=='tab'){atab=t.dataset.t;editId=null;render()}
 else if(a=='edit'){editId=id;render()}else if(a=='canc'){editId=null;render()}
 else if(a=='del'){if(active(id).length)return toast('Copies are on loan');if(!confirm('Delete this book?'))return;db.books=db.books.filter(b=>b.id!=id);db.holds=db.holds.filter(h=>h.bookId!=id);save();render()}
 else if(a=='role'){const u=usr(id);u.role=u.role=='admin'?'member':'admin';save();render()}
 else if(a=='rmu'){if(db.loans.some(l=>l.userId==id&&!l.ret))return toast('Member has active loans');if(!confirm('Remove member?'))return;db.users=db.users.filter(u=>u.id!=id);db.holds=db.holds.filter(h=>h.userId!=id);save();render()}
 else if(a=='skip'){db.off+=7;save();toast('Moved ahead 7 days');render()}
 else if(a=='reset'){if(confirm('Erase all data?')){db=seed();me=null;save();render()}}});
document.addEventListener('input',e=>{if(e.target.id=='q'){q=e.target.value;list()}});
document.addEventListener('change',e=>{if(e.target.id=='sj'){subj=e.target.value;list()}if(e.target.id=='ft'){filt=e.target.value;list()}});
document.addEventListener('submit',e=>{if(e.target.id!='bf')return;e.preventDefault();const f=Object.fromEntries(new FormData(e.target));f.copies=Math.max(1,+f.copies||1);
 if(editId){const b=bk(editId);if(f.copies<active(b.id).length)return toast('Fewer copies than currently on loan');Object.assign(b,f)}else db.books.push({id:nid(),...f});
 editId=null;save();toast('Saved');render()});
load();render();
