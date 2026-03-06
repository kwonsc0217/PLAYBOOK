const $=id=>document.getElementById(id),
designWt={branding:[{n:'Keyart',w:8,t:4,nt:'• Keyart는 컨셉수립~완성까지 충분한 시간 필요\n• 초기 방향성 설정 중요, 레퍼런스 권장'},{n:'Logo',w:8,t:4,nt:'• 브랜드 아이덴티티 핵심\n• 다양한 적용환경 고려'},{n:'Brand Guide',w:8,t:4,nt:'• 전체 브랜드 시스템 구축\n• 폰트,컬러,템플릿 포함'}],sns:[{n:'YouTube Thumbnail',w:2,t:2,nt:'• 빠른 제작 가능\n• 채널 톤앤매너 확인 필요'},{n:'SNS / PR Images',w:2,t:2,nt:'• 플랫폼별 최적 사이즈 제작\n• 대외용 PR은 높은 완성도 요구'}],mkt:[{n:'OOH/Poster',w:3,t:4,nt:'• 제작방식/사이즈에 따라 난이도 상이'},{n:'Package/Goods',w:3,t:4,nt:'• 제작방식/사이즈에 따라 난이도 상이'}]},
designCats=[{id:'branding',nm:'Branding',desc:'Keyart / Logo / Brand Guide'},{id:'sns',nm:'SNS Content',desc:'YouTube Thumbnail / SNS / PR Images'},{id:'mkt',nm:'MKT etc.',desc:'OOH / Poster / Package / Goods'}];
var faqs=[];  // FAQ는 위키(GCD PLAYBOOK - FAQ 페이지)에서만 로드. 스크립트 기본값 미노출
var wt=JSON.parse(JSON.stringify(designWt));
var cats=designCats.slice();
var partIds=[];  // 서버 /api/parts 에서 채움 (design, video, ...)
var currentPart='design';
var wikiPageCache={};
var wikiContextCache={};
var wikiAssetsCache={};
var defaultSlides=[]; // 위키 이미지만 사용 (imgur 미사용)
var slides=defaultSlides.slice();
var slidesByWorkType={};
let selCat,selWork,selWeeks,curSlide=0;
function partDisplayName(id){ return (id||'').charAt(0).toUpperCase()+(id||'').slice(1).toLowerCase(); }
var creativeAssetsMode=false;  // IP 버튼 클릭 시 true → 01. CREATIVE ASSETS 표시
function updateAssetPanelTitle(){
  var el=document.getElementById('assetPanelTitle');
  if(!el)return;
  if(creativeAssetsMode){ el.textContent='01. CREATIVE ASSETS'; return; }
  if(currentPart==='design')el.textContent='01. DESIGN ASSETS';
  else if(currentPart==='video')el.textContent='01. VIDEO ASSETS';
  else el.textContent='01. '+partDisplayName(currentPart).toUpperCase()+' ASSETS';
}

function goHome(){
  document.body.classList.remove('split-expanded');
  document.querySelectorAll('.ip-btn').forEach(b=>b.classList.remove('sel'));
  var chat=document.getElementById('chat');
  if(chat)chat.classList.remove('show');
  chatExpanded=false;
  var msgs=document.getElementById('msgs');
  if(msgs)msgs.innerHTML='';
  creativeAssetsMode=false;
  updateAssetPanelTitle();
  var list=document.getElementById('assetList');
  if(list){
    list.classList.remove('asset-grid');
    list.innerHTML='<div class="asset-empty" id="assetEmpty"><span class="asset-loading-text">AI가 생각 중...</span></div>';
  }
}

// Init + 이벤트 바인딩 — DOM 준비 후 한 번에 실행 (스크립트 오류 방지)
function initDOM(){
  const catGrid=document.getElementById('catGrid');
  const faqList=document.getElementById('faqList');
  const dotsEl=document.getElementById('dots');
  if(catGrid)catGrid.innerHTML=cats.map(c=>`<div class="cat-item" data-c="${c.id}"><span class="cat-item-line"><strong class="tw">${c.nm}</strong> ${c.desc}</span></div>`).join('');
  if(faqList)faqList.innerHTML='<div class="faq-loading" id="faqLoading">위키에서 FAQ를 불러오는 중…</div>';
  if(dotsEl)dotsEl.innerHTML=slides.map((_,i)=>`<span class="sl-dot${i===0?' on':''}" data-i="${i}"></span>`).join('');
  bindEvents();
}
function bindEvents(){
  const sBtn=document.getElementById('sBtn');
  const cBtn=document.getElementById('cBtn');
  const sInput=document.getElementById('sInput');
  const cInput=document.getElementById('cInput');
  const ipBtns=document.getElementById('ipBtns');
  if(sBtn)sBtn.onclick=()=>sendChat();
  if(cBtn)cBtn.onclick=()=>sendChat();
  if(sInput)sInput.onkeypress=e=>{if(e.key==='Enter')sendChat();};
  if(cInput)cInput.onkeypress=e=>{if(e.key==='Enter')sendChat();};
  if(ipBtns)ipBtns.onclick=e=>{const btn=e.target.closest('.ip-btn');if(btn&&btn.dataset.query){document.querySelectorAll('.ip-btn').forEach(b=>b.classList.remove('sel'));btn.classList.add('sel');sendChat(btn.dataset.query);}};
  const logoEl=document.querySelector('.logo');
  if(logoEl)logoEl.onclick=goHome;
  const catGridEl=document.getElementById('catGrid');
  if(catGridEl)catGridEl.onclick=e=>{const el=e.target.closest('.cat-item');if(el)selectCat(el.dataset.c);};
  const wtGridEl=document.getElementById('wtGrid');
  if(wtGridEl)wtGridEl.onclick=e=>{const el=e.target.closest('.cat-item');if(el)selectWork(el);};
  const slPrev=document.getElementById('slPrev');
  const slNext=document.getElementById('slNext');
  const dots=document.getElementById('dots');
  const preview=document.getElementById('preview');
  const modalClose=document.getElementById('modalClose');
  if(slPrev)slPrev.onclick=e=>{e.stopPropagation();updateSlide((curSlide-1+slides.length)%slides.length);};
  if(slNext)slNext.onclick=e=>{e.stopPropagation();updateSlide((curSlide+1)%slides.length);};
  if(dots)dots.onclick=e=>{if(e.target.classList.contains('sl-dot')){e.stopPropagation();updateSlide(+e.target.dataset.i);}};
  if(preview)preview.onclick=e=>{if(!e.target.closest('.sl-arr,.sl-dot')&&!e.target.closest('video')&&slides.length&&slides[curSlide]){openSlideModal(slides[curSlide]);}};
  if(modalClose)modalClose.onclick=()=>closeSlideModal();
  const reqDate=document.getElementById('reqDate');
  const dlDate=document.getElementById('dlDate');
  if(reqDate)reqDate.onchange=function(){if(this.value&&selWeeks){const dl=document.getElementById('dlDate');if(dl){dl.value=addBiz(new Date(this.value),selWeeks*5).toISOString().split('T')[0];dl.dispatchEvent(new Event('change'));}}};
  if(dlDate)dlDate.onchange=function(){
    if(!this.value||!selWork)return;
    const s=new Date(document.getElementById('reqDate').value),e=new Date(this.value),tot=getBiz(s,e),r1=addBiz(s,Math.floor(tot*.5)),r2=addBiz(s,Math.floor(tot*.8));
    const tlVisual=document.getElementById('tlVisual');if(tlVisual)tlVisual.innerHTML=`<div class="tl-track"><div class="tl-line"></div><div class="tl-ms"><div class="ms-dot"></div><div class="ms-label">시작</div><div class="ms-date">${fmt(s)}</div></div><div class="tl-ms"><div class="ms-dot r1"></div><div class="ms-label r1">R1</div><div class="ms-date">WIP</div></div><div class="tl-ms"><div class="ms-dot r2"></div><div class="ms-label r2">R2</div><div class="ms-date">Near Final</div></div><div class="tl-ms"><div class="ms-dot dl"></div><div class="ms-label dl">완료</div><div class="ms-date">Delivery</div></div></div><div class="tl-phases"><div class="phase r1"><h4>R1 - WIP (50%)</h4><div class="date">${fmt(r1)}</div></div><div class="phase r2"><h4>R2 - Near Final (80%)</h4><div class="date">${fmt(r2)}</div></div><div class="phase dl"><h4>최종 마감</h4><div class="date">${fmt(e)}</div></div></div>`;
    const formSec=document.getElementById('formSec');if(formSec)formSec.style.display='block';
    const fReqDate=document.getElementById('fReqDate');if(fReqDate)fReqDate.value=document.getElementById('reqDate').value;
    const fWork=document.getElementById('fWork');if(fWork)fWork.value=selWork;
    const fDl=document.getElementById('fDl');if(fDl)fDl.value=this.value;
    setTimeout(()=>{const fs=document.getElementById('formSec');if(fs)fs.scrollIntoView({behavior:'smooth'});},300);
  };
  const submitBtn=document.getElementById('submitBtn');
  if(submitBtn)submitBtn.onclick=async function(){try{var ok=await copyRequestToClipboard();if(ok){alert('복사완료! 위키에 붙여넣기(Ctrl+V) 하세요.');this.textContent='✔ 복사 완료';this.style.background='#00c853';setTimeout(()=>{this.textContent='요청서 복사';this.style.background='';},2000);}else alert('복사 실패');}catch(e){alert('복사 실패');}};
  const faqListEl=document.getElementById('faqList');
  if(faqListEl)faqListEl.onclick=e=>{const q=e.target.closest('.faq-q');if(!q)return;const isOn=q.classList.contains('on');document.querySelectorAll('.faq-q').forEach(el=>el.classList.remove('on'));document.querySelectorAll('.faq-a').forEach(el=>el.classList.remove('on'));if(!isOn){q.classList.add('on');q.nextElementSibling.classList.add('on');}};
}
// DOM 준비 후 초기화 (한 번만 실행)
let initDone=false;
function runInit(){
  if(initDone)return;
  if(!document.body){ setTimeout(runInit,10); return; }
  var catGrid=document.getElementById('catGrid');
  if(!catGrid){ setTimeout(runInit,10); return; }
  initDone=true;
  try{ initDOM(); }catch(e){ console.error('initDOM:',e); initDone=false; }
  // 파트 목록 및 탭 (Design | Video 등)
  fetch('/api/parts').then(function(r){ return r.json(); }).then(function(data){
    partIds=Array.isArray(data.parts)?data.parts:[];
    var tabParts=partIds.length>1?partIds:['design','video'];
    var wrap=document.getElementById('partTabsWrap');
    var tabEl=document.getElementById('partTabs');
    if(wrap)wrap.style.display='flex';
    if(tabEl){
      tabEl.innerHTML=tabParts.map(function(p){ return '<button type="button" class="part-tab'+(p===currentPart?' active':'')+'" data-part="'+p+'">'+partDisplayName(p)+'</button>'; }).join('');
      tabEl.onclick=function(e){ var btn=e.target.closest('.part-tab'); if(btn&&btn.dataset.part)switchPart(btn.dataset.part); };
    }
    // 모든 파트 위키 어셋 최초 1회 미리 로드 (탭 전환 시 즉시 표시)
    tabParts.forEach(function(p){ getWikiAssets(p); });
  }).catch(function(){
    partIds=['design','video'];
    var wrap=document.getElementById('partTabsWrap');
    var tabEl=document.getElementById('partTabs');
    if(wrap)wrap.style.display='flex';
    if(tabEl){
      tabEl.innerHTML=['design','video'].map(function(p){ return '<button type="button" class="part-tab'+(p===currentPart?' active':'')+'" data-part="'+p+'">'+partDisplayName(p)+'</button>'; }).join('');
      tabEl.onclick=function(e){ var btn=e.target.closest('.part-tab'); if(btn&&btn.dataset.part)switchPart(btn.dataset.part); };
    }
    ['design','video'].forEach(function(p){ getWikiAssets(p); });
  });
  // 01. ASSETS: 최초에는 카드 없이 문구만 노출. 검색 또는 IP 상황 선택 시에만 카드 표시
  // design + video 위키 어셋 최초 1회만 로드 (탭 전환 시 캐시 사용, 즉시 표시)
  getWikiAssets('design').then(function(assets){
    window.wikiAssets=assets||[];
    slidesByWorkType={};
    (assets||[]).forEach(function(a){ if(a.images&&a.images.length) slidesByWorkType[a.name]=a.images; });
  });
  getWikiAssets('video'); // VIDEO 탭 클릭 시 즉시 표시되도록 미리 로드
  getWikiPageData(currentPart).then(function(data){
    var faqEl=document.getElementById('faqList');
    if(!faqEl)return;
    var list=data&&Array.isArray(data.faq)&&data.faq.length>0?data.faq:[];
    if(list.length>0){
      faqs=list;
      faqEl.innerHTML=faqs.map(function(pair){ var q=String(typeof pair[0]!=='undefined'?pair[0]:'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); var a=String(typeof pair[1]!=='undefined'?pair[1]:'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); return '<div class="faq-item"><button class="faq-q tw" type="button"><span>'+q+'</span><span class="faq-icon">▼</span></button><div class="faq-a"><div class="faq-a-ct">'+a+'</div></div></div>'; }).join('');
    }else{
      faqEl.innerHTML=data&&data.configured?'<div class="faq-loading">위키 FAQ 페이지에 항목이 없거나 형식을 확인해 주세요. (GCD PLAYBOOK - FAQ)</div>':'<div class="faq-loading">위키 연동 시 FAQ가 표시됩니다. 실행방법.txt의 Confluence 설정을 확인해 주세요.</div>';
    }
  }).catch(function(){ var faqEl=document.getElementById('faqList'); if(faqEl) faqEl.innerHTML='<div class="faq-loading">FAQ를 불러오지 못했습니다. 서버 및 위키 설정을 확인해 주세요.</div>'; });
}

// 위키 분류명 → 카테고리 ID (비디오 등 분류 탭 기준)
function categoryIdFromName(catName){
  if(!catName||typeof catName!=='string')return '';
  return catName.toLowerCase().replace(/\s+/g,'_').replace(/[^a-z0-9_]/g,'');
}
function buildWorkItemFromAsset(a){
  var w=parseWeeks(a.duration);
  var t=countSteps(a.steps);
  var nt=(Array.isArray(a.details)&&a.details.length)?a.details.map(function(d){ return '• '+d; }).join('\n'):'';
  return { n:a.name, w:w!=null&&!isNaN(w)?w:2, wDisplay:(a.duration&&String(a.duration).trim())?String(a.duration).trim():'2주', t:t>0?t:2, nt:nt };
}

// 파트 전환 시 아래 카테고리 영역만 변경. 위 추천 카드(assetPanel)는 유지
function switchPart(partId,callback){
  if(partId===currentPart){ if(callback)callback(); return; }
  currentPart=partId||'design';
  document.querySelectorAll('.part-tab').forEach(function(el){ el.classList.toggle('active',el.dataset.part===currentPart); });
  if(currentPart==='design'){
    cats=designCats.slice();
    wt=JSON.parse(JSON.stringify(designWt));
  }else{
    cats=[{id:currentPart,nm:partDisplayName(currentPart),desc:'위키 기준 작업 유형'}];
    wt={};
  }
  var catGrid=document.getElementById('catGrid');
  if(catGrid)catGrid.innerHTML=cats.map(function(c){ return '<div class="cat-item" data-c="'+c.id+'"><span class="cat-item-line"><strong class="tw">'+c.nm+'</strong> '+c.desc+'</span></div>'; }).join('');
  document.getElementById('tlSec').style.display='none';
  var formSec=document.getElementById('formSec'); if(formSec)formSec.style.display='none';
  selCat=null; selWork=null; selWeeks=null;
  getWikiAssets(currentPart).then(function(assets){
    window.wikiAssets=assets||[];
    slidesByWorkType={};
    (assets||[]).forEach(function(a){ if(a.images&&a.images.length) slidesByWorkType[a.name]=a.images; });
    if(currentPart!=='design'){
      var withCategory=(assets||[]).filter(function(a){ return a.category&&String(a.category).trim(); });
      if(withCategory.length>0){
        var order=[];
        var byCat={};
        (assets||[]).forEach(function(a){
          var cat=String(a.category||'').trim();
          if(!cat){ cat='_none'; if(order.indexOf(cat)===-1)order.push(cat); }
          else if(order.indexOf(cat)===-1)order.push(cat);
          if(!byCat[cat])byCat[cat]=[];
          byCat[cat].push(a);
        });
        cats=order.map(function(catName){
          var cid=catName==='_none'?currentPart:categoryIdFromName(catName)||currentPart;
          var desc=(byCat[catName]||[]).map(function(a){ return a.name; }).join(' / ');
          return { id:cid, nm:catName==='_none'?partDisplayName(currentPart):catName, desc:desc };
        });
        wt={};
        order.forEach(function(catName){
          var cid=catName==='_none'?currentPart:categoryIdFromName(catName)||currentPart;
          wt[cid]=byCat[catName].map(buildWorkItemFromAsset);
        });
      }else{
        wt[currentPart]=(assets||[]).map(buildWorkItemFromAsset);
      }
      if(catGrid)catGrid.innerHTML=cats.map(function(c){ return '<div class="cat-item" data-c="'+c.id+'"><span class="cat-item-line"><strong class="tw">'+c.nm+'</strong> '+c.desc+'</span></div>'; }).join('');
    }
    // 탭 전환 시 추천 카드(assetPanel)는 변경하지 않음. 카테고리 영역만 갱신됨
    if(callback)callback();
  });
}
document.addEventListener('DOMContentLoaded',runInit);
if(document.readyState!=='loading')runInit();
window.GCDPlaybookInit=runInit;

// 현재 프로젝트 컨텍스트 저장
let projectContext={projectName:'',workType:'',category:'',direction:'',background:'',purpose:'',requester:'',department:'',reference:'',spec:''};

// ========== Vertex AI (서버 경유) + 위키 도메인 지식 ==========
// 위키는 파트별 최초 1회만 불러오고, 이후에는 브라우저 메모리 캐시를 사용
async function getWikiPageData(part){
  var p=part!=null?part:currentPart;
  var key=p||'design';
  if(wikiPageCache[key]) return wikiPageCache[key];
  try{
    const res=await fetch('/api/wiki?part='+encodeURIComponent(key));
    if(!res.ok) return { content:'', faq:[], configured:false };
    const data=await res.json();
    wikiPageCache[key]=data||{ content:'', faq:[], configured:false };
    wikiContextCache[key]=(data&&data.content!=null)?String(data.content).trim():'';
    return wikiPageCache[key];
  }catch(e){
    return { content:'', faq:[], configured:false };
  }
}

// 위키 본문 컨텍스트는 파트별 최초 1회만 조회
async function getWikiContext(part){
  var p=part!=null?part:currentPart;
  var key=p||'design';
  if(typeof wikiContextCache[key]==='string'&&wikiContextCache[key]!==undefined) return wikiContextCache[key];
  try{
    const data=await getWikiPageData(key);
    return (data.content!=null)?String(data.content).trim():'';
  }catch(e){ return ''; }
}

// 01. ASSETS 카드는 선택 파트의 위키 어셋 (design / video 등) — 파트별 최초 1회만 조회
async function getWikiAssets(part){
  var p=part!=null?part:currentPart;
  var key=p||'design';
  if(Array.isArray(wikiAssetsCache[key])) return wikiAssetsCache[key];
  try{
    const res=await fetch('/api/wiki-assets?part='+encodeURIComponent(key));
    if(!res.ok) return [];
    const data=await res.json();
    const assets=Array.isArray(data.assets)?data.assets:[];
    wikiAssetsCache[key]=assets;
    return assets;
  }catch(e){ return []; }
}

async function callGemini(prompt,maxTokens=500,opts){
  const body={prompt,maxTokens};
  if(opts&&opts.wikiContext!=null&&String(opts.wikiContext).trim())body.wikiContext=String(opts.wikiContext).trim();
  const res=await fetch('/api/gemini',{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify(body)
  });
  if(!res.ok){
    const err=await res.json().catch(()=>({}));
    throw new Error(err.error||'Gemini 연결 실패: '+res.status);
  }
  const data=await res.json();
  return (data.text!=null)?String(data.text).trim():'';
}

// 필요 어셋 추천 (Gemini). opts.wikiContext 있으면 사용, opts.creativeMode면 IP용 통합 6개, opts.contextAware면 디자인/비디오 맥락 판단 후 해당 탭 항목만
async function getRecommendedAssets(userInput,opts){
  var isCreative=opts&&opts.creativeMode;
  var contextAware=opts&&opts.contextAware;
  var prompt=isCreative
    ?`당신은 게임/IP 크리에이티브(디자인·비디오 등) 팀의 도우미입니다.
사용자 입력: "${userInput}"

위에 주어진 [팀 위키(도메인 지식)]에는 디자인·비디오 등 여러 작업 항목이 있습니다. 이 IP 상황에 맞는 항목을 위키에 적힌 이름 그대로 6개 이내로 추천하세요.

다음 JSON 형식으로만 응답하세요.
{
  "reply": "사용자에게 할 짧은 답변 (2~4문장). 오른쪽에 추천 목록이 표시된다고 안내.",
  "assets": [
    { "name": "위키에 있는 작업명 그대로", "duration": "예: 6~8주", "details": ["상세 1"] }
  ]
}
규칙: reply는 한국어로. assets는 위키에 나온 작업명만 사용. 최대 6개. duration·details는 위키 참고.`
    :contextAware
    ?`당신은 게임/IP 크리에이티브(디자인·비디오) 팀의 도우미입니다.
사용자 입력: "${userInput}"

위 [팀 위키]에는 디자인 작업(키아트, 로고, Brand Guide, SNS, OOH/포스터 등)과 비디오 작업(시네마틱 트레일러, 게임플레이 트레일러, 티저, 숏폼 영상 등)이 모두 나열되어 있습니다.

**맥락 판단**: 사용자 요청이 "영상·트레일러·비디오·게임플레이 영상·시네마틱·티저·홍보 영상" 등이면 **비디오** 위키 항목만 추천하세요. "키아트·로고·디자인·SNS·포스터·썸네일·브랜딩" 등이면 **디자인** 위키 항목만 추천하세요.

다음 JSON만 응답하세요.
{
  "reply": "친절한 한국어 답변 (2~4문장). 추천한 유형(디자인/비디오)과 오른쪽 표시를 안내.",
  "assets": [ { "name": "위키 작업명 그대로", "duration": "예: 6~8주", "details": ["상세"] } ]
}
규칙: assets는 위키에 있는 이름만. 한 요청에 디자인·비디오 섞지 말고, 맥락에 맞는 한 쪽만 3~6개.`
    :`당신은 게임/IP 마케팅 디자인 팀의 도우미입니다.
사용자 입력: "${userInput}"

위에 주어진 [팀 위키(도메인 지식)]에 나열된 작업(어셋) 항목만을 기준으로 추천하세요.

다음 JSON 형식으로만 응답하세요. 다른 설명은 하지 마세요.
{
  "reply": "사용자에게 할 짧은 답변 (2~4문장). 이 상황에 필요한 작업을 요약하고, 오른쪽에 목록이 표시된다고 안내.",
  "assets": [
    { "name": "위키에 있는 작업명 그대로", "duration": "예: 6~8주", "details": ["상세 1", "상세 2"] }
  ]
}

규칙:
- reply는 친근하고 간결하게, 한국어로.
- assets는 반드시 위키(도메인 지식)에 적힌 작업 항목만 포함하세요. 위키에 없는 항목은 추천하지 마세요.
- 트레일러, 영상 제작, 부스 영상 등은 디자인팀 영역이 아니므로 추천하지 마세요.
- name은 반드시 아래 중 하나만 사용: KEYART, Logo, Brand Guide, Youtube Thumbnail, SNS Images, PR Images, OOH / Poster, Package, Goods (위키 행 기준). 이 외 항목은 추천하지 마세요.
- duration·details는 위키 내용을 참고하여 작성. 3~6개 정도, 이 IP/상황에 맞는 위키 내 작업만 제안.`;

  try{
    var wikiCtx=(opts&&opts.wikiContext!=null)?String(opts.wikiContext).trim():await getWikiContext();
    const raw=await callGemini(prompt,800,{wikiContext:wikiCtx});
    let jsonStr=(raw||'{}').replace(/```json\n?|\n?```/g,'').trim();
    const objMatch=jsonStr.match(/\{[\s\S]*\}/);
    if(objMatch)jsonStr=objMatch[0];
    const parsed=JSON.parse(jsonStr);
    const reply=parsed.reply&&String(parsed.reply).trim()?parsed.reply:'해당 상황에 맞는 어셋을 오른쪽에 표시했습니다.';
    const assets=Array.isArray(parsed.assets)?parsed.assets:[];
    return {reply,assets};
  }catch(e){
    console.error('getRecommendedAssets failed:',e);
    return {
      reply:'입력해 주신 상황에 맞는 어셋을 추천해 드리겠습니다. 오른쪽 패널을 확인해 주세요.',
      assets:[]
    };
  }
}

// 노출 허용 작업 항목만 사용. 위키 항목명·작업 유형과 매칭되도록 동의어 포함
var ALLOWED_ASSET_NAMES=['keyart','logo','brand guide','youtube thumbnail','sns images','pr images','sns / pr images','ooh / poster','ooh/poster','package','goods'];
function normAssetName(s){ return (s+'').trim().toLowerCase().replace(/\s*\/\s*/g,' ').replace(/\s+/g,' '); }
function isAllowedAssetName(name){
  var n=normAssetName(name);
  if(!n)return false;
  return ALLOWED_ASSET_NAMES.some(function(a){ var na=normAssetName(a); return n===na||n.indexOf(na)>=0||na.indexOf(n)>=0; });
}
function filterByAllowedAssets(assets){
  if(!Array.isArray(assets))return [];
  return assets.filter(function(a){ return isAllowedAssetName(a.name); });
}

// 카드에 항상 위키의 기간·상세·이미지를 표시. 위키에 있으면 duration/details/images를 위키 값으로 교체.
function mergeWithWikiData(assets,wikiAssets){
  if(!Array.isArray(assets)||assets.length===0)return assets;
  if(!Array.isArray(wikiAssets)||wikiAssets.length===0)return assets;
  var wikiByNorm={};
  wikiAssets.forEach(function(w){ var n=normAssetName(w.name); if(n){ wikiByNorm[n]=w; } });
  return assets.map(function(a){
    var n=normAssetName(a.name);
    if(!n)return a;
    var match=wikiByNorm[n];
    if(!match){
      for(var key in wikiByNorm){ if(key.indexOf(n)>=0||n.indexOf(key)>=0){ match=wikiByNorm[key]; break; } }
    }
    if(!match)return a;
    return { name: match.name, duration: match.duration||a.duration, details: Array.isArray(match.details)?match.details:(a.details||[]), images: match.images||a.images };
  });
}

// AI 추천 어셋 중 위키에 정의된 항목만 필터 (이름 매칭). 위키 항목의 duration/details 사용. 허용 목록에 있는 것만.
function filterRecommendedByWiki(aiAssets,wikiAssets){
  var allowedWiki=filterByAllowedAssets(wikiAssets);
  if(!Array.isArray(allowedWiki)||allowedWiki.length===0)return [];
  if(!Array.isArray(aiAssets)||aiAssets.length===0)return allowedWiki;
  var wikiNames=allowedWiki.map(function(a){ return normAssetName(a.name); });
  function nameMatches(aiName){
    var key=normAssetName(aiName);
    if(!key)return -1;
    var idx=wikiNames.indexOf(key);
    if(idx>=0)return idx;
    return wikiNames.findIndex(function(w){ return w.indexOf(key)>=0||key.indexOf(w)>=0; });
  }
  var seen={};
  var out=[];
  for(var i=0;i<aiAssets.length;i++){
    if(!isAllowedAssetName(aiAssets[i].name))continue;
    var name=(aiAssets[i].name||'').trim();
    var idx=nameMatches(name);
    if(idx>=0&&!seen[idx]){
      seen[idx]=true;
      out.push(allowedWiki[idx]);
    }
  }
  return out.length?out:allowedWiki;
}

// IP/크리에이티브 모드: 허용 목록 없이 전체 위키 어셋 중 이름 매칭해 추천 (최대 6개)
function filterRecommendedByWikiAll(aiAssets,wikiAssets){
  if(!Array.isArray(wikiAssets)||wikiAssets.length===0)return [];
  if(!Array.isArray(aiAssets)||aiAssets.length===0)return wikiAssets.slice(0,6);
  var seen={};
  var out=[];
  for(var i=0;i<aiAssets.length&&out.length<6;i++){
    var name=(aiAssets[i].name||'').trim();
    if(!name)continue;
    for(var j=0;j<wikiAssets.length;j++){
      if(seen[j])continue;
      if(matchWorkToAsset(wikiAssets[j].name,name)){ seen[j]=true; out.push(wikiAssets[j]); break; }
    }
  }
  return out.length?out:wikiAssets.slice(0,6);
}

// 어셋 이름 → 카테고리/작업유형 매핑 (요청서 작성 연결용). creative 모드일 때 part 반환
function getCategoryFromAssetName(name){
  var assets=window.wikiAssets||[];
  for(var i=0;i<assets.length;i++){
    if(!matchWorkToAsset(assets[i].name,name))continue;
    if(assets[i].category) return {cid:categoryIdFromName(assets[i].category)||'video',work:assets[i].name,part:'video'};
    var nn=(name+'').toLowerCase();
    if(/keyart|키아트|키비주얼/i.test(nn))return {cid:'branding',work:'Keyart',part:'design'};
    if(/logo|로고/i.test(nn))return {cid:'branding',work:'Logo',part:'design'};
    if(/brand\s*guide|브랜드\s*가이드/i.test(nn))return {cid:'branding',work:'Brand Guide',part:'design'};
    if(/youtube|thumb|썸네일/i.test(nn))return {cid:'sns',work:'YouTube Thumbnail',part:'design'};
    if(/sns|sns\s*image|pr\s*image|pr\s*이미지|소셜|대외용/i.test(nn))return {cid:'sns',work:'SNS / PR Images',part:'design'};
    if(/ooh|poster|포스터/i.test(nn))return {cid:'mkt',work:'OOH/Poster',part:'design'};
    if(/package|goods|패키지|굿즈/i.test(nn))return {cid:'mkt',work:'Package/Goods',part:'design'};
    return {cid:'branding',work:assets[i].name,part:'design'};
  }
  if(currentPart&&currentPart!=='design'){
    for(var j=0;j<assets.length;j++){
      if(assets[j].category&&matchWorkToAsset(assets[j].name,name))
        return {cid:categoryIdFromName(assets[j].category)||currentPart,work:assets[j].name};
    }
    return {cid:currentPart,work:name};
  }
  if(!name)return {cid:'branding',work:null};
  var n=(name+'').toLowerCase();
  if(/keyart|키아트|키비주얼/i.test(n))return {cid:'branding',work:'Keyart'};
  if(/logo|로고/i.test(n))return {cid:'branding',work:'Logo'};
  if(/brand\s*guide|브랜드\s*가이드/i.test(n))return {cid:'branding',work:'Brand Guide'};
  if(/youtube|thumb|썸네일/i.test(n))return {cid:'sns',work:'YouTube Thumbnail'};
  if(/sns|sns\s*image|pr\s*image|pr\s*이미지|소셜|대외용/i.test(n))return {cid:'sns',work:'SNS / PR Images'};
  if(/ooh|poster|포스터/i.test(n))return {cid:'mkt',work:'OOH/Poster'};
  if(/package|goods|패키지|굿즈/i.test(n))return {cid:'mkt',work:'Package/Goods'};
  if(/마케팅|mkt/i.test(n))return {cid:'mkt',work:null};
  if(/branding|브랜딩/i.test(n))return {cid:'branding',work:null};
  if(/mkt|마케팅/i.test(n))return {cid:'mkt',work:null};
  return {cid:'branding',work:null};
}

function escHtml(s){ return (s+'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

// 오른쪽 필요 어셋 패널 렌더
function renderAssetPanel(assets){
  var list=document.getElementById('assetList');
  if(!list)return;
  var arr=Array.isArray(assets)?assets:[];
  if(arr.length===0){
    list.classList.remove('asset-grid');
    list.innerHTML='<div class="asset-empty" id="assetEmpty">위키에 필수 어셋 목록(테이블)을 입력하면 여기에 표시됩니다. 위키 설정: 실행방법 참고.</div>';
    return;
  }
  list.classList.add('asset-grid');
  try{
    list.innerHTML=arr.map(function(a,i){
      var rawName=a.name||'어셋';
      var name=escHtml(rawName);
      var duration=escHtml(a.duration||'')||'-';
      var details=Array.isArray(a.details)?a.details:[];
      var detailHtml=details.length
        ?'<div class="asset-detail"><ul>'+details.map(function(d){return '<li>'+escHtml(d)+'</li>';}).join('')+'</ul></div>'
        :'';
      var escAttr=rawName.replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
      return '<div class="asset-item" data-i="'+i+'" data-asset-name="'+escAttr+'"><h4>'+name+'</h4><div class="asset-meta">'+duration+'</div>'+detailHtml+'<div class="asset-more-wrap"><button type="button" class="asset-goto-request">요청서 작성</button><button type="button" class="asset-more" title="더 알아보기"><span class="asset-more-arrow">▼</span> 더보기</button></div></div>';
    }).join('');
  }catch(e){
    console.error('renderAssetPanel:',e);
    list.classList.remove('asset-grid');
    list.innerHTML='<div class="asset-empty" id="assetEmpty">어셋 목록을 표시하는 중 오류가 발생했습니다.</div>';
    return;
  }
  list.querySelectorAll('.asset-item').forEach(function(el){
    var more=el.querySelector('.asset-more');
    var gotoBtn=el.querySelector('.asset-goto-request');
    var assetName=el.getAttribute('data-asset-name')||'';
    function goToRequestForm(){
      var mapped=getCategoryFromAssetName(assetName);
      var catSec=document.getElementById('catSec');
      if(catSec)catSec.scrollIntoView({behavior:'smooth',block:'start'});
      if(mapped.part&&mapped.part!==currentPart) switchPart(mapped.part,function(){ selectCat(mapped.cid,mapped.work); });
      else selectCat(mapped.cid,mapped.work);
    }
    if(more){
      more.onclick=function(){
        el.classList.toggle('open');
        var arrow=more.querySelector('.asset-more-arrow');
        if(arrow){
          arrow.textContent=el.classList.contains('open')?'▲':'▼';
        }
        more.title=el.classList.contains('open')?'접기':'더 알아보기';
        more.lastChild.textContent=el.classList.contains('open')?' 접기':' 더보기';
      };
    }
    if(gotoBtn)gotoBtn.onclick=goToRequestForm;
  });
}

// AI API 호출하여 사용자 입력 파싱 (개인 Gemini API)
async function parseWithAI(text){
  const prompt=`당신은 게임회사 디자인팀의 요청서 작성 도우미입니다.
사용자가 다음과 같이 입력했습니다:
"${text}"

사용자의 의도를 파악하고 다음 정보를 추출해주세요.
반드시 아래 JSON 형식으로만 응답하세요. 다른 설명은 하지 마세요.

{
  "intent": "request(요청서 작성 의도) 또는 question(단순 질문/정보 문의) 또는 edit(수정 요청) 또는 delete(삭제 요청)",
  "category": "branding 또는 sns 또는 mkt 또는 null",
  "workType": "Keyart, Logo, Brand Guide, YouTube Thumbnail, SNS / PR Images, OOH/Poster, Package/Goods 중 하나 또는 null",
  "deadline": "YYYY-MM-DD 형식 또는 null",
  "projectName": "프로젝트명 또는 null",
  "direction": "디자인 방향/컨셉 또는 null",
  "background": "프로젝트 배경 또는 null",
  "requester": "요청자 이름만 (2-4글자 한글) 또는 null",
  "department": "부서/팀명만 (예: 마케팅팀, 퍼블리싱팀) 또는 null",
  "purpose": "프로젝트 목적 또는 null",
  "reference": "레퍼런스 URL 또는 설명 또는 null",
  "spec": "사이즈, 파일형식 등 또는 null",
  "editField": "수정/삭제 요청시 해당 필드명 또는 null",
  "editValue": "수정할 값 (삭제시 빈 문자열) 또는 null",
  "questionTopic": "질문 주제 (예: 작업기간, 수정횟수, 긴급요청, 파일형식, 진행상황 등) 또는 null"
}

의도 판단 기준:
- "~하고 싶어요", "~해주세요", "~요청드려요", "~만들어주세요" → intent: request
- "~인가요?", "~할까요?", "~어떻게?", "얼마나?", "몇 번?", "가능한가요?" → intent: question
- "~로 바꿔", "~로 변경", "~로 수정" → intent: edit
- "~삭제해줘", "~지워줘", "~비워줘" → intent: delete

참고:
- 키아트, keyart → category: branding, workType: Keyart
- 로고, logo → category: branding, workType: Logo  
- SNS, 인스타, PR, 대외용 → category: sns, workType: SNS / PR Images
- 유튜브, 썸네일 → category: sns, workType: YouTube Thumbnail
- 포스터, OOH → category: mkt, workType: OOH/Poster
- 패키지, 굿즈 → category: mkt, workType: Package/Goods
- 날짜는 현재 연도(${new Date().getFullYear()})를 기준으로 파싱
- 요청자 이름은 순수 이름만 추출
- 부서/팀은 팀명만 추출`;

  try{
    const wikiCtx=await getWikiContext();
    const responseText=await callGemini(prompt,500,{wikiContext:wikiCtx});
    let jsonStr=(responseText||'{}').replace(/```json\n?|\n?```/g,'').trim();
    const objMatch=jsonStr.match(/\{[\s\S]*\}/);
    if(objMatch)jsonStr=objMatch[0];
    // AI가 비표준 JSON으로 반환할 수 있음 → 보정 후 파싱
    function parseJsonRelaxed(str){
      try{return JSON.parse(str);}catch(_){}
      const s=str
        .replace(/(\{|,)\s*([a-zA-Z_][a-zA-Z0-9_-]*)\s*:/g,'$1"$2":')  // intent: → "intent":
        .replace(/(\{|,)\s*'([^']+)'\s*:/g,'$1"$2":')                  // 'intent': → "intent":
        .replace(/,(\s*[}\]])/g,'$1');                                  // trailing comma 제거
      try{return JSON.parse(s);}catch(e){throw e;}
    }
    const parsed=parseJsonRelaxed(jsonStr);
    return parsed;
  }catch(e){
    console.error('AI parsing failed:',e);
    return {intent:'question'};
  }
}

// AI API 호출하여 텍스트 정제
async function refineWithAI(field,rawText){
  const fieldPrompts={
    background:`사용자(요청자)가 디자인팀에 작업을 의뢰하는 상황입니다.
"프로젝트 배경" 항목에 대해 다음과 같이 입력했습니다:
"${rawText}"

이 내용을 보고서/기안서 형식의 간결한 문구로 정제해주세요.
- 1-2문장, 개조식/명사형 종결
- "~입니다", "~합니다" 등 존댓말 종결어미 사용 금지
- 예시: "PUBG 9주년 기념 글로벌 마케팅 캠페인 진행에 따른 키비주얼 제작 필요"
- 프로젝트 정보: ${projectContext.projectName||'미정'}, ${projectContext.workType||'미정'}
- 추가 설명 없이 정제된 문구만 출력`,
    
    purpose:`사용자(요청자)가 디자인팀에 작업을 의뢰하는 상황입니다.
"프로젝트 목적" 항목에 대해 다음과 같이 입력했습니다:
"${rawText}"

이 내용을 보고서/기안서 형식의 간결한 문구로 정제해주세요.
- 1-2문장, 개조식/명사형 종결
- "~입니다", "~합니다" 등 존댓말 종결어미 사용 금지
- 예시: "신규 유저 유입 및 기존 유저 리텐션 강화", "글로벌 브랜드 인지도 제고"
- 프로젝트 정보: ${projectContext.projectName||'미정'}, ${projectContext.workType||'미정'}
- 추가 설명 없이 정제된 문구만 출력`,
    
    direction:`사용자(요청자)가 디자인팀에 작업을 의뢰하는 상황입니다.
"디자인 디렉션" 항목에 대해 다음과 같이 입력했습니다:
"${rawText}"

이 내용을 보고서/기안서 형식의 간결한 문구로 정제해주세요.
- 1-2문장, 개조식/명사형 종결
- "~입니다", "~합니다", "~원합니다" 등 존댓말 종결어미 사용 금지
- 예시: "퓨쳐리스틱하고 역동적인 비주얼, SF 요소와 속도감 있는 구도 활용"
- 프로젝트 정보: ${projectContext.projectName||'미정'}, ${projectContext.workType||'미정'}
- 추가 설명 없이 정제된 문구만 출력`
  };

  try{
    const wikiCtx=await getWikiContext();
    const out=await callGemini(fieldPrompts[field]||rawText,200,{wikiContext:wikiCtx});
    return out||rawText;
  }catch(e){
    console.error('AI refinement failed:',e);
    return rawText;
  }
}

// AI 파싱 함수
function parseUserInput(text){
  const result={category:null,workType:null,deadline:null,projectName:null,direction:null,background:null,requester:null,department:null,purpose:null,reference:null,spec:null,editField:null,editValue:null};
  const s=text.toLowerCase();
  
  // 수정 요청 감지
  const editPatterns=[
    {pattern:/(?:이름|요청자)[은는을를]?\s*(.+?)(?:로|으로)\s*(?:바꿔|변경|수정)/,field:'requester'},
    {pattern:/(?:부서|팀)[은는을를]?\s*(.+?)(?:로|으로)\s*(?:바꿔|변경|수정)/,field:'department'},
    {pattern:/(?:배경)[은는을를]?\s*(.+?)(?:로|으로)\s*(?:바꿔|변경|수정)/,field:'background'},
    {pattern:/(?:목적)[은는을를]?\s*(.+?)(?:로|으로)\s*(?:바꿔|변경|수정)/,field:'purpose'},
    {pattern:/(?:디렉션|컨셉)[은는을를]?\s*(.+?)(?:로|으로)\s*(?:바꿔|변경|수정)/,field:'direction'},
    {pattern:/(?:레퍼런스|참고)[은는을를]?\s*(.+?)(?:로|으로)\s*(?:바꿔|변경|수정)/,field:'reference'},
    {pattern:/(?:스펙)[은는을를]?\s*(.+?)(?:로|으로)\s*(?:바꿔|변경|수정)/,field:'spec'},
    {pattern:/(?:제목|프로젝트명)[은는을를]?\s*(.+?)(?:로|으로)\s*(?:바꿔|변경|수정)/,field:'projectName'},
    {pattern:/(?:마감일|마감|데드라인)[은는을를]?\s*(.+?)(?:로|으로)\s*(?:바꿔|변경|수정)/,field:'deadline'},
    // 역순 패턴: "바꿔줘 이름을 홍길동으로"
    {pattern:/(?:바꿔|변경|수정).*?(?:이름|요청자)[은는을를]?\s*(.+?)(?:로|으로|$)/,field:'requester'},
    {pattern:/(?:바꿔|변경|수정).*?(?:부서|팀)[은는을를]?\s*(.+?)(?:로|으로|$)/,field:'department'},
    {pattern:/(?:바꿔|변경|수정).*?(?:배경)[은는을를]?\s*(.+?)(?:로|으로|$)/,field:'background'},
    {pattern:/(?:바꿔|변경|수정).*?(?:목적)[은는을를]?\s*(.+?)(?:로|으로|$)/,field:'purpose'},
    {pattern:/(?:바꿔|변경|수정).*?(?:디렉션|컨셉)[은는을를]?\s*(.+?)(?:로|으로|$)/,field:'direction'},
    // 간단한 수정 패턴: "이름 홍길동으로 바꿔"
    {pattern:/(?:이름|요청자)[은는을를]?\s*[:, ]?\s*([가-힣]{2,4})(?:로|으로)?\s*(?:바꿔|변경|수정)/,field:'requester'},
    {pattern:/(?:부서|팀)[은는을를]?\s*[:, ]?\s*([가-힣A-Za-z0-9]+(?:팀|부서|파트)?)(?:로|으로)?\s*(?:바꿔|변경|수정)/,field:'department'},
  ];
  
  for(const ep of editPatterns){
    const m=text.match(ep.pattern);
    if(m){
      result.editField=ep.field;
      // 조사 및 불필요한 문자 제거
      result.editValue=m[1].trim().replace(/^[은는이가을를]\s*/,'').replace(/[으로로]$/,'').trim();
      return result;
    }
  }
  
  // 삭제 요청 감지
  const deletePatterns=[
    {pattern:/(?:배경)[을를]?\s*(?:지워|삭제|비워)/,field:'background'},
    {pattern:/(?:목적)[을를]?\s*(?:지워|삭제|비워)/,field:'purpose'},
    {pattern:/(?:디렉션|컨셉)[을를]?\s*(?:지워|삭제|비워)/,field:'direction'},
    {pattern:/(?:레퍼런스|참고)[을를]?\s*(?:지워|삭제|비워)/,field:'reference'},
    {pattern:/(?:스펙)[을를]?\s*(?:지워|삭제|비워)/,field:'spec'},
  ];
  
  for(const dp of deletePatterns){
    if(dp.pattern.test(text)){
      result.editField=dp.field;
      result.editValue='';
      return result;
    }
  }
  
  // 카테고리 & 작업유형 추출
  if(s.includes('키아트')||s.includes('keyart')){result.category='branding';result.workType='Keyart';}
  else if(s.includes('로고')||s.includes('logo')){result.category='branding';result.workType='Logo';}
  else if(s.includes('브랜드 가이드')||s.includes('brand guide')){result.category='branding';result.workType='Brand Guide';}
  else if(s.includes('유튜브')||s.includes('youtube')||s.includes('썸네일')){result.category='sns';result.workType='YouTube Thumbnail';}
  else if(s.includes('sns')||s.includes('인스타')||s.includes('pr')||s.includes('홍보')){result.category='sns';result.workType='SNS / PR Images';}
  else if(s.includes('포스터')||s.includes('ooh')){result.category='mkt';result.workType='OOH/Poster';}
  else if(s.includes('굿즈')||s.includes('패키지')){result.category='mkt';result.workType='Package/Goods';}
  
  // 날짜 추출
  const datePatterns=[/(\d{1,2})월\s*(\d{1,2})일/,/(\d{4})[-./](\d{1,2})[-./](\d{1,2})/,/(\d{1,2})[-./](\d{1,2})/];
  for(const p of datePatterns){
    const m=text.match(p);
    if(m){
      const now=new Date();
      let y=now.getFullYear(),mo,d;
      if(m.length===4){y=parseInt(m[1]);mo=parseInt(m[2]);d=parseInt(m[3]);}
      else if(m.length===3){mo=parseInt(m[1]);d=parseInt(m[2]);}
      if(mo<now.getMonth()+1||(mo===now.getMonth()+1&&d<now.getDate()))y++;
      result.deadline=`${y}-${String(mo).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      break;
    }
  }
  
  // 프로젝트명 추출
  const gameNames=['pubg','배그','펍지','배틀그라운드','뉴스테이트','뉴스','다크앤다커','다크엔다커','인조이','엔조이'];
  let gameName='',eventName='';
  for(const g of gameNames){if(s.includes(g)){gameName=g.toUpperCase();if(g==='배그'||g==='펍지'||g==='배틀그라운드')gameName='PUBG';if(g==='뉴스테이트'||g==='뉴스')gameName='NEW STATE';if(g==='다크앤다커'||g==='다크엔다커')gameName='DARK AND DARKER';if(g==='인조이'||g==='엔조이')gameName='inZOI';break;}}
  const eventMatch=text.match(/(\d+)\s*(주년|시즌)/);
  if(eventMatch)eventName=`${eventMatch[1]}${eventMatch[2]}`;
  if(gameName||eventName)result.projectName=`${gameName} ${eventName}`.trim();
  
  // 컨셉/디렉션 추출
  const concepts=['퓨쳐리스틱','미래적','사이버펑크','레트로','빈티지','미니멀','모던','다크','밝은','화려한','심플','고급스러운','캐주얼','프리미엄','다이나믹','역동적'];
  for(const c of concepts){if(s.includes(c)){result.direction=c;break;}}
  
  // 배경 추출
  const bgPatterns=[/배경[은는이가]?\s*[:.]?\s*(.+?)(?:[.!?]|그리고|,|$)/,/(?:이유|계기)[은는이가]?\s*[:.]?\s*(.+?)(?:[.!?]|$)/];
  for(const p of bgPatterns){const m=text.match(p);if(m){result.background=m[1].trim();break;}}
  
  // 요청자 추출 (유관부서 담당자)
  const namePatterns=[
    /(?:제?\s*이름[은는이가]?\s*[:.]?\s*)([가-힣]{2,4})/,
    /(?:저는|나는|내\s*이름은?)\s*([가-힣]{2,4})/,
    /([가-힣]{2,4})(?:이라고\s*해|입니다|이에요|예요|야|이야)/,
    /([가-힣]{2,4})\s*(?:PM|피엠|매니저|담당|담당자)/,
    /(?:PM|피엠|매니저|담당|담당자)[은는이가]?\s*([가-힣]{2,4})/
  ];
  for(const p of namePatterns){const m=text.match(p);if(m){result.requester=m[1];break;}}
  
  // 부서/팀 추출 (요청하는 유관부서)
  const deptPatterns=[
    /(?:부서|팀)[은는이가]?\s*[:.]?\s*([가-힣A-Za-z0-9\s]+?)(?:이야|입니다|이에요|예요|야|이고|에서|[.!?,]|$)/,
    /([가-힣A-Za-z]+(?:팀|부서|파트|본부|실|스튜디오))(?:에서|소속|이야|입니다|이에요|예요|야|이고|[.!?,\s]|$)/,
    /(마케팅|퍼블리싱|개발|사업|운영|PM|기획|프로듀싱)(?:팀|부서|파트)?/
  ];
  for(const p of deptPatterns){
    const m=text.match(p);
    if(m){
      let dept=m[1].trim();
      // 팀/부서 접미사 없으면 추가
      if(!/(?:팀|부서|파트|본부|실|스튜디오)$/.test(dept)){
        if(['마케팅','퍼블리싱','개발','사업','운영','기획','프로듀싱'].includes(dept))dept+='팀';
      }
      result.department=dept;
      break;
    }
  }
  
  // 목적 추출
  const purposePatterns=[/목적[은는이가]?\s*[:.]?\s*(.+?)(?:[.!?]|그리고|,|$)/,/(?:위해서?|위한)\s*(.+?)(?:[.!?]|$)/];
  for(const p of purposePatterns){const m=text.match(p);if(m){result.purpose=m[1].trim();break;}}
  
  // 레퍼런스 추출
  const urlMatch=text.match(/(https?:\/\/[^\s]+)/);
  if(urlMatch)result.reference=urlMatch[1];
  const refMatch=text.match(/(?:레퍼런스|참고|참조)[은는이가]?\s*[:.]?\s*(.+?)(?:[.!?]|$)/);
  if(refMatch)result.reference=result.reference?result.reference+', '+refMatch[1].trim():refMatch[1].trim();
  
  // 스펙 추출
  let specs=[];
  const sizeMatch=text.match(/(\d+)\s*[xX×]\s*(\d+)/);
  if(sizeMatch)specs.push(`${sizeMatch[1]}x${sizeMatch[2]}`);
  const formatMatch=text.match(/(png|jpg|jpeg|ai|psd|pdf)/gi);
  if(formatMatch)specs.push(...formatMatch.map(f=>f.toUpperCase()));
  if(specs.length)result.spec=specs.join(', ');
  
  return result;
}

// 필드 수정 함수
async function editField(field,value){
  const fieldMap={
    requester:{el:'fName',label:'요청자',needsAI:false},
    department:{el:'fDept',label:'부서/팀',needsAI:false},
    background:{el:'fBg',label:'배경',needsAI:true},
    purpose:{el:'fPurpose',label:'목적',needsAI:true},
    direction:{el:'fDir',label:'디렉션',needsAI:true},
    reference:{el:'fRef',label:'레퍼런스',needsAI:false},
    spec:{el:'fSpec',label:'스펙',needsAI:false},
    projectName:{el:'projTitle',label:'프로젝트명',needsAI:false},
    deadline:{el:'fDl',label:'마감일',needsAI:false}
  };
  
  const info=fieldMap[field];
  if(!info)return null;
  
  let finalValue=value;
  if(value&&info.needsAI){
    finalValue=await refineWithAI(field,value);
  }
  
  if(field==='deadline'&&value){
    // 날짜 파싱
    const datePatterns=[/(\d{1,2})월\s*(\d{1,2})일/,/(\d{4})[-./](\d{1,2})[-./](\d{1,2})/];
    for(const p of datePatterns){
      const m=value.match(p);
      if(m){
        const now=new Date();
        let y=now.getFullYear(),mo,d;
        if(m.length===4){y=parseInt(m[1]);mo=parseInt(m[2]);d=parseInt(m[3]);}
        else{mo=parseInt(m[1]);d=parseInt(m[2]);}
        finalValue=`${y}-${String(mo).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
        $('dlDate').value=finalValue;
        $('dlDate').dispatchEvent(new Event('change'));
        break;
      }
    }
  }else{
    $(info.el).value=finalValue;
  }
  
  // 컨텍스트 업데이트
  if(field in projectContext)projectContext[field]=finalValue;
  
  return {field:info.label,value:finalValue};
}

// 자동 폼 채우기 (AI 정제 포함)
async function autoFillForm(data,isUpdate=false){
  let hasFormData=false;
  
  // 컨텍스트 업데이트
  if(data.projectName)projectContext.projectName=data.projectName;
  if(data.workType)projectContext.workType=data.workType;
  if(data.category)projectContext.category=cats.find(c=>c.id===data.category)?.nm||data.category;
  
  // 프로젝트 제목
  if(data.projectName){
    $('projTitle').value=data.projectName;
    hasFormData=true;
  }
  
  // 단순 필드 (이름, 부서, 스펙)
  if(data.requester){$('fName').value=data.requester;hasFormData=true;}
  if(data.department){$('fDept').value=data.department;hasFormData=true;}
  if(data.spec){$('fSpec').value=$('fSpec').value?$('fSpec').value+', '+data.spec:data.spec;hasFormData=true;}
  if(data.reference){$('fRef').value=$('fRef').value?$('fRef').value+'\n'+data.reference:data.reference;hasFormData=true;}
  
  // AI 정제가 필요한 필드
  if(data.background){
    const refined=await refineWithAI('background',data.background);
    $('fBg').value=refined;
    projectContext.background=refined;
    hasFormData=true;
  }
  if(data.purpose){
    const refined=await refineWithAI('purpose',data.purpose);
    $('fPurpose').value=refined;
    projectContext.purpose=refined;
    hasFormData=true;
  }
  if(data.direction){
    const refined=await refineWithAI('direction',data.direction);
    $('fDir').value=refined;
    projectContext.direction=refined;
    hasFormData=true;
  }
  
  // 카테고리/작업유형 선택 시 전체 플로우
  if(data.category){
    selectCat(data.category,data.workType);
    setTimeout(()=>{
      if(data.workType){
        const wtEl=[...$('wtGrid').children].find(e=>e.dataset.w===data.workType);
        if(wtEl)selectWork(wtEl);
      }
      setTimeout(()=>{
        const today=new Date();
        if(!$('reqDate').value)$('reqDate').value=today.toISOString().split('T')[0];
        if(data.deadline){
          $('dlDate').value=data.deadline;
          $('dlDate').dispatchEvent(new Event('change'));
        }else if(hasFormData){
          // 마감일 없어도 폼 데이터 있으면 폼 섹션 표시
          $('formSec').style.display='block';
          $('fReqDate').value=$('reqDate').value;
          $('fWork').value=selWork||'';
          setTimeout(()=>$('formSec').scrollIntoView({behavior:'smooth'}),300);
        }
      },300);
    },100);
  }else if(hasFormData){
    // 카테고리 없이 폼 데이터만 있는 경우 (추가 정보 입력)
    $('formSec').style.display='block';
    setTimeout(()=>$('formSec').scrollIntoView({behavior:'smooth'}),300);
  }
}

// 채팅 메시지 (버튼 포함)
function addMsg(t,isUser,buttons=[]){
  var msgsEl=document.getElementById('msgs');
  if(!msgsEl)return;
  const m=document.createElement('div');
  m.className='msg '+(isUser?'user':'bot');
  let btnHtml='';
  if(buttons&&buttons.length){
    btnHtml='<div class="action-btns">'+buttons.map(function(b){return '<button class="action-btn '+(b.type||'')+'" data-action="'+(b.action||'')+'">'+(b.label||'')+'</button>';}).join('')+'</div>';
  }
  m.innerHTML=isUser?'<div class="bubble">'+t+'</div>':'<div class="bot-hd"><div class="bot-av">😊</div><div class="tw" style="font-size:1.1rem">GCD PLAYBOOK</div></div><div class="bot-ct">'+(typeof t==='string'?t.split('\n').filter(function(p){return p.trim();}).map(function(p){return '<p>'+p+'</p>';}).join(''):'')+btnHtml+'</div>';
  msgsEl.appendChild(m);
  msgsEl.scrollTop=msgsEl.scrollHeight;
  m.querySelectorAll('.action-btn').forEach(function(btn){
    btn.onclick=function(){ handleAction(btn.dataset.action); };
  });
}

// 버튼 액션 처리
async function handleAction(action){
  if(action==='startRequest'){
    addMsg('요청서 작성을 시작할게요!',false);
    // 저장된 파싱 데이터로 폼 채우기
    if(pendingData){
      await autoFillForm(pendingData,false);
      pendingData=null;
    }
  }else if(action==='moreInfo'){
    addMsg('궁금한 점이 있으시면 편하게 물어봐주세요! 작업 기간, 수정 횟수, 필요한 자료 등 무엇이든 답변해드릴게요 😊',false);
  }
}

let pendingData=null; // 요청서 작성 대기 데이터

function generateResponse(data,original){
  let msg='안녕하세요! GCD 디자인팀입니다. 😊\n\n';
  let buttons=[];
  let warnings=[];
  
  // 수정/삭제 요청 처리
  if(data.intent==='edit'||data.intent==='delete'){
    if(data.editValue===''){
      msg+=`<b>${getFieldLabel(data.editField)}</b> 항목을 삭제했어요! ✂️`;
    }else{
      msg+=`<b>${getFieldLabel(data.editField)}</b> 항목을 수정했어요! ✏️\n\n`;
      msg+=`변경된 내용이 오른쪽 폼에 반영되었습니다.`;
    }
    return {msg,buttons};
  }
  
  // 단순 질문 처리
  if(data.intent==='question'){
    const answers={
      '작업기간':`작업별 예상 소요 기간이에요:\n\n• <b>Branding</b> (Keyart, Logo, Brand Guide): 약 8주\n• <b>SNS Content</b> (YouTube 썸네일, SNS/PR 이미지): 약 2주\n• <b>MKT</b> (OOH, Poster, Package, Goods): 약 3주`,
      '수정횟수':`작업별 수정 가능 횟수예요:\n\n• <b>Branding</b>: 초안 3회, 세부 수정 2회\n• <b>SNS Content</b>: 초안 2회, 세부 수정 1회\n• <b>MKT Asset</b>: 초안 2회, 세부 수정 2회\n\n추가 수정이 필요하면 일정 조율이 필요해요.`,
      '긴급요청':`긴급 요청은 <b>최소 2주 전</b>에 말씀해주셔야 해요.\n\n팀 상황에 따라 조율이 필요할 수 있으니, 급하신 건이 있으시면 먼저 담당자와 협의해주세요!`,
      '파일형식':`일반적으로 <b>PNG, JPG, AI, PSD</b> 등의 형식으로 제공해드려요.\n\n요청 시 원하시는 형식을 딜리버리 스펙에 명시해주시면 됩니다!`,
      '진행상황':`요청서 제출 후 담당 디자이너가 배정되면, 각 라운드(R1, R2, R3)마다 진행 상황을 공유해드려요.\n\n• R1: WIP (50%)\n• R2: Near Final (80%)\n• R3: Final (90%)\n• Delivery: 완료`,
      '레퍼런스':`레퍼런스는 필수는 아니지만, 원하시는 방향을 명확히 전달하는 데 큰 도움이 돼요!\n\n이미지, URL, 텍스트 설명 모두 가능합니다.`
    };
    
    const topic=data.questionTopic||'';
    let answered=false;
    for(const[key,answer]of Object.entries(answers)){
      if(topic.includes(key)||original.includes(key)){
        msg+=answer;
        answered=true;
        break;
      }
    }
    
    if(!answered){
      msg+=`궁금하신 내용에 대해 답변드릴게요!\n\n`;
      if(data.workType){
        const wtData=wt[data.category]?.find(w=>w.n===data.workType);
        if(wtData){
          msg+=`<b>${data.workType}</b> 작업은 보통 <b>${wtData.w}주</b> 정도 소요돼요.\n\n`;
        }
      }
      msg+=`더 궁금한 점이 있으시면 편하게 물어봐주세요!`;
    }
    
    // 요청서 작성 유도 버튼
    if(data.category||data.workType){
      msg+=`\n\n이 작업으로 요청서를 작성해드릴까요?`;
      buttons.push({label:'요청서 작성하기',action:'startRequest',type:''});
      buttons.push({label:'더 알아보기',action:'moreInfo',type:'secondary'});
      pendingData=data;
    }
    
    return {msg,buttons};
  }
  
  // 요청서 작성 의도
  if(data.intent==='request'){
    const updates=[];
    
    // 일정 체크
    if(data.deadline){
      const dl=new Date(data.deadline);
      const today=new Date();
      const diffDays=Math.ceil((dl-today)/(1000*60*60*24));
      const wtData=data.workType?wt[data.category]?.find(w=>w.n===data.workType):null;
      const requiredWeeks=wtData?.w||4;
      const requiredDays=requiredWeeks*7;
      
      if(diffDays<0){
        warnings.push(`⚠️ 입력하신 날짜가 과거예요. 희망 마감일을 다시 확인해주세요!`);
      }else if(diffDays<14){
        warnings.push(`💬 희망 마감일까지 <b>${diffDays}일</b> 정도 남았네요. 가이드 기준으로는 긴급 요청에 해당해서, 사전에 담당자와 일정 조율이 필요할 것 같아요.`);
      }else if(diffDays<requiredDays){
        warnings.push(`💬 ${data.workType||'해당 작업'}은 보통 <b>${requiredWeeks}주</b> 정도 소요되는데, 희망하신 일정은 약 <b>${Math.ceil(diffDays/7)}주</b>예요. 일정이 다소 촉박할 수 있어서 담당자와 조율이 필요해 보여요.`);
      }
    }
    
    if(data.category&&data.workType){
      const wtData=wt[data.category]?.find(w=>w.n===data.workType);
      msg+=`<b>${data.projectName||'프로젝트'}</b>의 <b>${data.workType}</b> 요청서 작성을 도와드릴게요!\n\n`;
      msg+=`아래 내용으로 요청서를 작성 중이에요:\n`;
      if(wtData)updates.push(`⏱️ 예상기간: ${wtData.w}주`);
      if(data.deadline)updates.push(`📅 희망마감일: ${data.deadline}`);
    }else{
      msg+=`요청서 작성을 도와드릴게요!\n\n`;
    }
    
    if(data.requester)updates.push(`👤 요청자: ${data.requester}`);
    if(data.department)updates.push(`🏢 요청부서: ${data.department}`);
    if(data.background)updates.push(`📝 배경: 입력완료`);
    if(data.purpose)updates.push(`🎯 목적: 입력완료`);
    if(data.direction)updates.push(`✨ 디렉션: 입력완료`);
    if(data.reference)updates.push(`🔗 레퍼런스: 입력완료`);
    if(data.spec)updates.push(`📐 스펙: ${data.spec}`);
    
    if(updates.length){
      msg+=updates.join('\n');
      if(warnings.length){
        msg+='\n\n'+warnings.join('\n');
      }
      msg+='\n\n오른쪽 폼에서 내용을 확인하고 부족한 부분을 채워주세요!\n추가 정보나 수정사항이 있으면 편하게 말씀해주세요 😊';
    }else{
      msg+=`<b>📝 이렇게 말씀해주시면 작성해드릴게요:</b>\n`;
      msg+=`"PUBG 9주년 키아트를 3월 15일까지 만들고 싶어요"\n\n`;
      msg+=`<b>👤 요청자 정보도 알려주세요:</b>\n`;
      msg+=`"마케팅팀 홍길동입니다"`;
    }
    
    return {msg,buttons};
  }
  
  // 기본 응답
  msg+=`무엇을 도와드릴까요?\n\n`;
  msg+=`<b>📝 요청서 작성</b>\n"PUBG 9주년 키아트를 만들고 싶어요"\n\n`;
  msg+=`<b>❓ 정보 문의</b>\n"키아트 작업 기간이 어떻게 돼요?"\n"수정은 몇 번까지 가능한가요?"`;
  
  return {msg,buttons};
}

function getFieldLabel(field){
  const labels={requester:'요청자',department:'부서/팀',background:'배경',purpose:'목적',direction:'디렉션',reference:'레퍼런스',spec:'스펙',projectName:'프로젝트명',deadline:'마감일'};
  return labels[field]||field;
}

let chatExpanded=false;

async function sendChat(text){
  document.body.classList.add('split-expanded');
  var sInput=document.getElementById('sInput'), cInput=document.getElementById('cInput');
  var v=typeof text==='string'?text:((sInput&&sInput.value)||(cInput&&cInput.value)||'').trim();
  if(!v)return;
  if(sInput)sInput.value='';
  if(cInput)cInput.value='';
  var chatEl=document.getElementById('chat');
  if(!chatExpanded&&chatEl){
    chatEl.classList.add('show');
    chatExpanded=true;
    addMsg('안녕하세요, 저는 GCD PLAYBOOK입니다. 필요한 어셋을 오른쪽에 추천해 드립니다.',false);
  }
  addMsg(v,true);

  const msgsEl=$('msgs');
  const typingEl=document.createElement('div');
  typingEl.className='msg bot';
  typingEl.id='typingMsg';
  typingEl.innerHTML=`<div class="bot-hd"><div class="bot-av">😊</div><div class="tw" style="font-size:1.1rem">GCD PLAYBOOK</div></div><div class="typing"><span></span><span></span><span></span></div>`;
  if(msgsEl)msgsEl.appendChild(typingEl);
  if(msgsEl)msgsEl.scrollTop=msgsEl.scrollHeight;

  var isIpSituation=/^#|^IP\s*상황\s*:/i.test(v);

  try{
    var toShow,fallback,result,reply;
    if(isIpSituation){
      var parts=partIds.length?partIds:['design','video'];
      var allAssets=[]; for(var pi=0;pi<parts.length;pi++){ var ax=await getWikiAssets(parts[pi]); allAssets=allAssets.concat(ax||[]); }
      var combinedWiki=''; for(var wi=0;wi<parts.length;wi++){ var ctx=await getWikiContext(parts[wi]); combinedWiki+=(ctx||'')+'\n\n'; }
      result=await getRecommendedAssets(v,{wikiContext:combinedWiki,creativeMode:true});
      reply=result.reply||'해당 IP 상황에 맞는 크리에이티브 어셋을 추천했습니다.';
      var typingDel=document.getElementById('typingMsg'); if(typingDel)typingDel.remove();
      addMsg(reply,false);
      toShow=filterRecommendedByWikiAll(result.assets||[],allAssets);
      if(!toShow.length)toShow=allAssets.slice(0,6); else toShow=mergeWithWikiData(toShow,allAssets).slice(0,6);
      window.wikiAssets=allAssets;
      allAssets.forEach(function(a){ if(a.images&&a.images.length) slidesByWorkType[a.name]=a.images; });
      creativeAssetsMode=true; updateAssetPanelTitle(); renderAssetPanel(toShow);
    }else{
      var parts=partIds.length?partIds:['design','video'];
      var allAssetsWithPart=[]; for(var pi=0;pi<parts.length;pi++){ var ax=await getWikiAssets(parts[pi]); (ax||[]).forEach(function(a){ a.part=parts[pi]; allAssetsWithPart.push(a); }); }
      var combinedWikiCtx=''; for(var wi=0;wi<parts.length;wi++){ var ctx2=await getWikiContext(parts[wi]); combinedWikiCtx+=(ctx2||'')+'\n\n'; }
      result=await getRecommendedAssets(v,{wikiContext:combinedWikiCtx,contextAware:true});
      reply=result.reply||'입력하신 내용에 맞는 어셋을 오른쪽에 표시했습니다.';
      var typingDel2=document.getElementById('typingMsg'); if(typingDel2)typingDel2.remove();
      addMsg(reply,false);
      var matched=filterRecommendedByWikiAll(result.assets||[],allAssetsWithPart);
      var targetPart='design'; for(var mi=0;mi<matched.length;mi++){ if(matched[mi].part==='video'){ targetPart='video'; break; } }
      var thatPartAssets=allAssetsWithPart.filter(function(a){ return a.part===targetPart; });
      toShow=matched.filter(function(a){ return a.part===targetPart; });
      if(!toShow.length)toShow=thatPartAssets.slice(0,6); else toShow=mergeWithWikiData(toShow,thatPartAssets);
      thatPartAssets.forEach(function(a){ if(a.images&&a.images.length) slidesByWorkType[a.name]=a.images; });
      window.wikiAssets=thatPartAssets;
      creativeAssetsMode=false;
      switchPart(targetPart,function(){ renderAssetPanel(toShow.length?toShow:thatPartAssets.slice(0,6)); });
    }
  }catch(e){
    var typing=document.getElementById('typingMsg');
    if(typing)typing.remove();
    addMsg('연결에 실패했습니다. 잠시 후 다시 시도해 주세요.',false);
    getWikiAssets().then(function(assets){ var a=currentPart==='design'?filterByAllowedAssets(assets):(assets||[]); if(a.length)a=mergeWithWikiData(a,assets); renderAssetPanel(a); });
  }

  // IP 상황 클릭 시에는 카드만 노출, 03. PROJECT DETAILS 자동 입력 안 함
  if(isIpSituation){ pendingData=null; return; }

  // 사용자 입력을 파싱해 03. PROJECT DETAILS에 다듬어서 자동 입력
  try{
    const parsed=await parseWithAI(v);
    var hasFormData=parsed&&(parsed.projectName||parsed.category||parsed.workType||parsed.requester||parsed.department||parsed.background||parsed.purpose||parsed.direction||parsed.deadline||parsed.reference||parsed.spec);
    var shouldAutoFill=parsed&&(parsed.intent==='request'||parsed.intent==='question')&&hasFormData;
    if(shouldAutoFill){
      await autoFillForm(parsed,false);
      addMsg('입력하신 내용을 <b>03. PROJECT DETAILS</b>에 반영해 두었어요. 확인 후 수정·보완해 주세요.',false);
      pendingData=null;
    }else if(parsed&&parsed.intent==='request'&&(parsed.category||parsed.workType||parsed.projectName)){
      pendingData=parsed;
    }else{
      pendingData=null;
    }
  }catch(_){pendingData=null;}
}

function findWikiMetaForWorkType(workName){
  var assets=window.wikiAssets||[];
  for(var i=0;i<assets.length;i++){
    if(matchWorkToAsset(assets[i].name,workName)) return assets[i];
  }
  return null;
}
function parseWeeks(str){
  if(!str||typeof str!=='string')return null;
  var m=str.match(/(\d+)\s*~\s*(\d+)|(\d+)\s*주/);
  if(m) return m[3]?parseInt(m[3],10):(m[2]?parseInt(m[2],10):parseInt(m[1],10));
  return null;
}
function countSteps(str){
  if(!str||typeof str!=='string')return 0;
  var parts=str.split(/[,;]/).map(function(s){ return s.trim(); }).filter(Boolean);
  if(parts.length>0) return parts.length;
  var rCount=(str.match(/R\s*\d+/gi)||[]).length;
  return rCount>0?rCount+1:0;
}
function getMergedWorkItem(t){
  var meta=findWikiMetaForWorkType(t.n);
  if(!meta) return { n:t.n, w:t.w, wDisplay:t.w+'주', t:t.t, nt:t.nt };
  var w=parseWeeks(meta.duration);
  var stepNum=countSteps(meta.steps);
  var nt=t.nt;
  if(meta.details&&meta.details.length) nt=meta.details.map(function(d){ return '• '+d; }).join('\n');
  var wDisplay=(meta.duration&&String(meta.duration).trim())?String(meta.duration).trim():((w!=null&&!isNaN(w))?w+'주':t.w+'주');
  return { n:t.n, w:(w!=null&&!isNaN(w))?w:t.w, wDisplay:wDisplay, t:stepNum>0?stepNum:t.t, nt:nt||t.nt };
}
// Category — 카테고리 선택 시 위키 어셋을 먼저 불러와 기간/단계/유의사항을 위키 값으로 표시
async function selectCat(cid,work){
  document.querySelectorAll('.cat-item').forEach(el=>el.classList.toggle('sel',el.dataset.c===cid));
  selCat=cid;
  $('wtTitle').textContent=cats.find(c=>c.id===cid).nm+' 작업 선택';
  try{
    var assets=await getWikiAssets();
    window.wikiAssets=assets||[];
  }catch(e){ window.wikiAssets=window.wikiAssets||[]; }
  (assets||[]).forEach(function(a){ if(a.images&&a.images.length) slidesByWorkType[a.name]=a.images; });
  var list=(wt[cid]||[]).map(getMergedWorkItem);
  $('wtGrid').innerHTML=list.map(t=>`<div class="cat-item" data-w="${t.n}" data-wk="${t.w}" data-wk-display="${(t.wDisplay||t.w+'주').replace(/"/g,'&quot;')}" data-steps="${t.t}" data-nt="${encodeURIComponent(t.nt)}"><strong class="tw">${t.n}</strong></div>`).join('');
  $('tlSec').style.display='none';
  if(work)setTimeout(()=>{const el=[...$('wtGrid').children].find(e=>e.dataset.w.includes(work.split('/')[0]));if(el)selectWork(el);},50);
}

// 위키 어셋명(wikiName)과 화면 작업 유형(selWork) 매칭 — 왼쪽(03. WORK TYPE)에 위키 기간·단계·이미지 반영
function matchWorkToAsset(wikiName, selWork){
  var a=(wikiName||'').toLowerCase().replace(/\s*\/\s*/g,' ').replace(/\s+/g,' ').trim();
  var b=(selWork||'').toLowerCase().replace(/\s*\/\s*/g,' ').replace(/\s+/g,' ').trim();
  if(!a||!b)return false;
  if(b==='sns pr images'&&(a==='sns images'||a==='pr images'||a==='sns pr images'))return true;
  if(b==='ooh poster'&&(a==='ooh poster'||a==='ooh / poster'||a.indexOf('ooh')!==-1&&a.indexOf('poster')!==-1))return true;
  if(b==='package goods'&&(a==='package'||a==='goods'||a==='package goods'||a.indexOf('package')!==-1||a.indexOf('goods')!==-1))return true;
  return a===b||a.indexOf(b)!==-1||b.indexOf(a)!==-1;
}
// Work Type
function selectWork(el){
  document.querySelectorAll('#wtGrid .cat-item').forEach(e=>e.classList.remove('sel'));
  el.classList.add('sel');
  selWork=el.dataset.w;
  selWeeks=+el.dataset.wk;
  $('selCat').textContent=cats.find(c=>c.id===selCat).nm;
  $('selWt').textContent=selWork;
  var wkDisplay=el.getAttribute('data-wk-display');
  $('estTime').textContent=(wkDisplay&&wkDisplay.trim()?wkDisplay:selWeeks+'주')+' 소요';
  var stepsEl=document.getElementById('estSteps');
  if(stepsEl) stepsEl.textContent=(el.dataset.steps||'-')+' 단계';
  $('notice').innerHTML=decodeURIComponent(el.dataset.nt||'').split('\n').map(l=>`<p>${l}</p>`).join('');
  var key=Object.keys(slidesByWorkType).find(function(k){return matchWorkToAsset(k,selWork);});
  slides=(key&&slidesByWorkType[key]&&slidesByWorkType[key].length)?slidesByWorkType[key]:defaultSlides.slice();
  curSlide=0;
  var dotsEl=document.getElementById('dots');
  if(dotsEl)dotsEl.innerHTML=slides.map(function(_,i){return '<span class="sl-dot'+(i===0?' on':'')+'" data-i="'+i+'"></span>';}).join('');
  if(slides.length){ updateSlide(0); } else { var p=$('preview'); if(p){ p.style.backgroundImage='none'; p.style.backgroundColor='#f0f0f0'; } }
  $('tlSec').style.display='block';
  $('tlSec').scrollIntoView({behavior:'smooth'});
}

// 영상 URL 여부. 직접 재생: .mp4/.webm/.mov/.ogv, 임베드: youtube/vimeo
function isVideoUrl(url){ if(!url||typeof url!=='string')return false; var u=url.toLowerCase(); return /\.(mp4|webm|mov|ogv)(\?|$)/i.test(u)||/youtube\.com|youtu\.be|vimeo\.com/i.test(u); }
function getEmbedVideoUrl(url){ if(!url)return ''; var m=url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/); if(m)return 'https://www.youtube.com/embed/'+m[1]; m=url.match(/vimeo\.com\/(?:video\/)?(\d+)/); if(m)return 'https://player.vimeo.com/video/'+m[1]; return ''; }
function openSlideModal(url){ var modal=$('modal'); var img=$('modalImg'); var vid=$('modalVideo'); var wrap=document.getElementById('modalVideoWrap'); if(!modal)return; if(isVideoUrl(url)){ if(img)img.style.display='none'; if(wrap)wrap.style.display='none'; var embed=getEmbedVideoUrl(url); if(embed){ if(vid)vid.style.display='none'; if(!wrap){ wrap=document.createElement('div'); wrap.id='modalVideoWrap'; wrap.style.cssText='max-width:90vw;max-height:80vh'; vid.parentNode.insertBefore(wrap,vid); } wrap.innerHTML='<iframe src="'+embed+'" style="width:90vw;height:50vw;max-height:80vh;border:0" allowfullscreen></iframe>'; wrap.style.display='block'; } else { if(wrap)wrap.style.display='none'; if(vid){ vid.src=url; vid.style.display='block'; vid.play().catch(function(){}); } } } else { if(wrap){ wrap.innerHTML=''; wrap.style.display='none'; } if(vid){ vid.pause(); vid.src=''; vid.style.display='none'; } if(img){ img.src=url; img.style.display='block'; } } modal.classList.add('on'); }
function closeSlideModal(){ var vid=$('modalVideo'); if(vid){ vid.pause(); vid.src=''; vid.style.display='none'; } var wrap=document.getElementById('modalVideoWrap'); if(wrap){ wrap.innerHTML=''; wrap.style.display='none'; } $('modal').classList.remove('on'); }
// Slider — 이미지면 배경, 영상이면 <video> 또는 youtube/vimeo iframe
function updateSlide(i){ if(!slides.length)return; curSlide=Math.max(0,Math.min(i,slides.length-1)); var p=$('preview'); if(!p)return; var url=slides[curSlide]; var v=p.querySelector('.sl-video'); var f=p.querySelector('.sl-iframe-wrap'); if(isVideoUrl(url)){ var embed=getEmbedVideoUrl(url); if(embed){ if(v){ v.pause(); v.removeAttribute('src'); v.style.display='none'; } if(!f){ f=document.createElement('div'); f.className='sl-iframe-wrap'; f.style.cssText='position:absolute;inset:0;width:100%;height:100%'; p.insertBefore(f,p.firstChild); } f.innerHTML='<iframe src="'+embed+'" style="width:100%;height:100%;border:0" allowfullscreen></iframe>'; f.style.display='block'; } else { if(f){ f.innerHTML=''; f.style.display='none'; } if(!v){ v=document.createElement('video'); v.className='sl-video'; v.controls=true; v.muted=true; v.playsInline=true; p.insertBefore(v,p.firstChild); } v.src=url; v.style.display='block'; v.play().catch(function(){}); } p.style.backgroundImage='none'; p.style.backgroundColor=''; } else { if(f){ f.innerHTML=''; f.style.display='none'; } if(v){ v.pause(); v.removeAttribute('src'); v.style.display='none'; } p.style.backgroundImage='url('+url+')'; p.style.backgroundColor=''; } document.querySelectorAll('.sl-dot').forEach(function(d,x){ d.classList.toggle('on',x===curSlide); }); }
const fmt=d=>`${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')}`;
const addBiz=(d,n)=>{let r=new Date(d),a=0;while(a<n){r.setDate(r.getDate()+1);if(r.getDay()%6)a++;}return r;};
const getBiz=(a,b)=>{let c=0,x=new Date(a);while(x<b){x.setDate(x.getDate()+1);if(x.getDay()%6)c++;}return c;};

// 요청서를 위키 붙여넣기용 테이블(HTML + 스타일)로 클립보드에 복사
function escapeHtml(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function nlToBr(s){ return String(s||'').trim().replace(/\r\n/g,'\n').replace(/\r/g,'\n').replace(/\n/g,'<br>'); }
function buildRequestTableHtml(rows){
  var thead='<table border="1" cellpadding="8" cellspacing="0" style="border-collapse:collapse;width:100%;max-width:800px;font-family:inherit;font-size:14px">';
  var body=rows.map(function(r){ return '<tr><td style="width:180px;vertical-align:top;font-weight:bold;background:#f5f5f5;border:1px solid #ddd">'+escapeHtml(r.label)+'</td><td style="border:1px solid #ddd">'+r.valueHtml+'</td></tr>'; }).join('');
  return thead+body+'</table>';
}
function buildRequestTablePlain(rows){
  var lines=rows.map(function(r){ return '**'+r.label+'**\n'+(r.valuePlain||'').trim().replace(/<br\s*\/?>/gi,'\n').replace(/&nbsp;/g,' '); });
  return lines.join('\n\n');
}
async function copyRequestToClipboard(){
  var $=id=>document.getElementById(id);
  var reqDate=($('fReqDate')&&$('fReqDate').value)||'';
  var reqYear=reqDate; if(reqDate&&reqDate.length>=10){ var p=reqDate.split('-'); if(p.length===3) reqYear=p[0]+'년 '+parseInt(p[1],10)+'월 '+parseInt(p[2],10)+'일'; }
  var dlDate=($('fDl')&&$('fDl').value)||'';
  var dlYear=dlDate; if(dlDate&&dlDate.length>=10){ var q=dlDate.split('-'); if(q.length===3) dlYear=q[0]+'년 '+parseInt(q[1],10)+'월 '+parseInt(q[2],10)+'일'; }
  function cellHtml(t){ return nlToBr(escapeHtml(String(t||''))); }
  var rows=[
    {label:'요청일*',valueHtml:escapeHtml(reqYear||reqDate),valuePlain:reqYear||reqDate},
    {label:'요청자*',valueHtml:escapeHtml($('fName')&&$('fName').value),valuePlain:($('fName')&&$('fName').value)||''},
    {label:'부서/팀*',valueHtml:escapeHtml($('fDept')&&$('fDept').value),valuePlain:($('fDept')&&$('fDept').value)||''},
    {label:'요청 업무*',valueHtml:cellHtml($('fWork')&&$('fWork').value),valuePlain:($('fWork')&&$('fWork').value)||''},
    {label:'희망 전달일*',valueHtml:escapeHtml(dlYear||dlDate),valuePlain:dlYear||dlDate},
    {label:'배경',valueHtml:cellHtml($('fBg')&&$('fBg').value),valuePlain:($('fBg')&&$('fBg').value)||''},
    {label:'목적',valueHtml:cellHtml($('fPurpose')&&$('fPurpose').value),valuePlain:($('fPurpose')&&$('fPurpose').value)||''},
    {label:'디렉션',valueHtml:cellHtml($('fDir')&&$('fDir').value),valuePlain:($('fDir')&&$('fDir').value)||''},
    {label:'레퍼런스',valueHtml:cellHtml($('fRef')&&$('fRef').value),valuePlain:($('fRef')&&$('fRef').value)||''},
    {label:'딜리버리 스펙*',valueHtml:cellHtml($('fSpec')&&$('fSpec').value),valuePlain:($('fSpec')&&$('fSpec').value)||''}
  ];
  var html='<meta charset="UTF-8">'+buildRequestTableHtml(rows);
  var plain=buildRequestTablePlain(rows);
  try{
    if(navigator.clipboard&&navigator.clipboard.write){
      await navigator.clipboard.write([new ClipboardItem({'text/html':new Blob([html],{type:'text/html'}),'text/plain':new Blob([plain],{type:'text/plain'})})]);
      return true;
    }
    await navigator.clipboard.writeText(plain);
    return true;
  }catch(e){
    try{ await navigator.clipboard.writeText(plain); return true; }catch(e2){ return false; }
  }
}
