const $=s=>document.querySelector(s);
let searchQuery = '';

const api=async(path,opts={})=>{
    const r=await fetch('/api'+path,{...opts,headers:{'Content-Type':'application/json',...opts.headers}});
    if(!r.ok) throw Error((await r.json().catch(()=>({}))).error||'Request failed');
    return r.status===204?null:r.json()
};

function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}

async function render(){
    const content = $('#leaderboardContent');
    content.innerHTML = `
        <article class="card leaderboard-container">
            <div class="leaderboard-grid">
                <div class="game-rank"><h3>Neural Hunter</h3><div id="rank-SNAKE" class="rank-list">Syncing...</div></div>
                <div class="game-rank"><h3>Grid Warfare</h3><div id="rank-TIC_TAC_TOE" class="rank-list">Syncing...</div></div>
                <div class="game-rank"><h3>Void Fragment</h3><div id="rank-BLOCK_BLAST" class="rank-list">Syncing...</div></div>
            </div>
        </article>
    `;

    for(const g of ['SNAKE','TIC_TAC_TOE','BLOCK_BLAST']){
        try{
            const r = await api('/leaderboard/'+g, {
                method:'POST',
                body: JSON.stringify({ search: searchQuery })
            });
            const el = $('#rank-'+g);
            if(el) el.innerHTML = r.length ? r.map((x,i)=>{
                const isTop = i < 3 && !searchQuery;
                const badge = isTop ? ['🥇','🥈','🥉'][i] : (i+1);
                return `<div class="rank-row ${isTop?'top-rank':''}">
                    <span class="pos">${badge}</span>
                    <span class="uid">${esc(x.game_id)}</span>
                    <span class="pts">${x.high_score.toLocaleString()}</span>
                </div>`;
            }).join('') : `<p class="empty">${searchQuery ? 'No match found' : 'No records'}</p>`;
        }catch(e){ console.error(e); }
    }
}

$('#searchBar').oninput = (e) => {
    searchQuery = e.target.value.trim();
    render();
};

function connect(){
    const socket=new WebSocket(`${location.protocol==='https:'?'wss':'ws'}://${location.host}/ws`);
    socket.onopen=()=>$('#connection').textContent='Connected to international grid';
    socket.onclose=()=>{ $('#connection').textContent='Searching for signal...'; setTimeout(connect,3000); };
    socket.onmessage=()=>render().catch(()=>{});
}

render().then(connect);
