'use strict';
/* =========================================================
   FoodFusion wallet: wallet.js
   - New users start with a ₹500 welcome balance
   - Add money (demo), pay at checkout, refunds on cancel
   Load this AFTER script.js
   ========================================================= */
(function () {
  const KEY = 'ff_wallet_v1', WELCOME = 500, MAX_ADD = 10000;
  const $ = id => document.getElementById(id);

  /* ---------- storage ---------- */
  function read() {
    try { const w = JSON.parse(localStorage.getItem(KEY)); if (w && typeof w.balance === 'number' && Array.isArray(w.txns)) return w; } catch {}
    return null;
  }
  let wallet = read() || { balance: WELCOME, txns: [{ type: 'credit', label: 'Welcome bonus', amount: WELCOME, at: Date.now(), order: null }] };
  const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(wallet)); } catch {} };
  persist();

  const when = t => new Date(t).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

  function credit(amount, label, order) {
    wallet.balance += amount;
    wallet.txns.unshift({ type: 'credit', label, amount, at: Date.now(), order: order || null });
    wallet.txns = wallet.txns.slice(0, 50);
    persist(); refresh();
  }
  function debit(amount, label, order) {
    wallet.balance -= amount;
    wallet.txns.unshift({ type: 'debit', label, amount, at: Date.now(), order: order || null });
    wallet.txns = wallet.txns.slice(0, 50);
    persist(); refresh();
  }

  /* ---------- UI: header chip ---------- */
  const chip = document.createElement('button');
  chip.type = 'button';
  chip.className = 'wl-chip hidden';
  chip.setAttribute('aria-label', 'Open wallet');
  chip.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 7a2 2 0 0 1 2-2h13v4"/><path d="M3 7v11a2 2 0 0 0 2 2h15V9H5a2 2 0 0 1-2-2z"/><circle cx="16.5" cy="14.5" r="1" fill="currentColor"/></svg><span>Wallet</span><b id="wl-chip-bal"></b>`;
  const headerEnd = document.querySelector('.header-end');
  if (headerEnd) headerEnd.insertBefore(chip, headerEnd.querySelector('.profile') || headerEnd.firstChild);

  /* ---------- UI: wallet popup ---------- */
  const modal = document.createElement('div');
  modal.id = 'wallet-modal';
  modal.className = 'wl-modal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-labelledby', 'wl-title');
  modal.innerHTML = `
    <div class="wl-card">
      <button class="wl-close" aria-label="Close wallet">×</button>
      <h2 id="wl-title">FusionWallet</h2>
      <div class="wl-balance"><small>Available balance</small><b id="wl-big"></b></div>
      <div class="wl-add">
        <span>Add money</span>
        <div class="wl-quick">
          <button type="button" data-amt="100">+ ₹100</button>
          <button type="button" data-amt="500">+ ₹500</button>
          <button type="button" data-amt="1000">+ ₹1000</button>
        </div>
        <form class="wl-custom"><input type="number" min="1" max="${MAX_ADD}" step="1" placeholder="Other amount" aria-label="Other amount"><button>Add</button></form>
      </div>
      <h3>Recent activity</h3>
      <div id="wl-list"></div>
      <small class="wl-note">Demo wallet. No real money is used. Choose "Wallet" as the payment method at checkout.</small>
    </div>`;
  document.body.append(modal);

  const openWallet = () => { refresh(); modal.classList.add('open'); };
  const closeWallet = () => modal.classList.remove('open');
  chip.onclick = openWallet;
  modal.querySelector('.wl-close').onclick = closeWallet;
  modal.addEventListener('click', e => { if (e.target === modal) closeWallet(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeWallet(); });

  function addMoney(n) {
    n = Math.floor(Number(n));
    if (!n || n < 1) return toast('Enter a valid amount');
    if (n > MAX_ADD) return toast(`You can add up to ${money(MAX_ADD)} at a time`);
    credit(n, 'Added to wallet');
    toast(`${money(n)} added to your wallet`);
  }
  modal.querySelectorAll('[data-amt]').forEach(b => b.onclick = () => addMoney(b.dataset.amt));
  modal.querySelector('.wl-custom').addEventListener('submit', e => {
    e.preventDefault();
    const i = e.target.querySelector('input');
    addMoney(i.value);
    i.value = '';
  });

  /* ---------- render ---------- */
  function refresh() {
    const bal = money(wallet.balance);
    $('wl-chip-bal').textContent = bal;
    $('wl-big').textContent = bal;
    $('wl-list').innerHTML = wallet.txns.length
      ? wallet.txns.slice(0, 15).map(t =>
        `<div class="wl-row"><div>${safe(t.label)}<small>${when(t.at)}</small></div><b class="${t.type === 'credit' ? 'cr' : 'dr'}">${t.type === 'credit' ? '+' : '-'}${money(t.amount)}</b></div>`).join('')
      : '<p class="wl-empty">No activity yet.</p>';
    syncOption();
  }

  /* add / update the "Wallet" choice in the checkout payment list */
  function syncOption() {
    const sel = $('payment-mode');
    if (!sel) return;
    let o = [...sel.options].find(x => x.value === 'Wallet');
    if (!o) { o = new Option('', 'Wallet'); sel.add(o, 1); }
    o.text = `Wallet (${money(wallet.balance)} available)`;
  }

  /* show the chip only for signed-in customers */
  const appView = $('app-view');
  function vis() {
    const show = !appView.classList.contains('hidden') && currentUser && currentUser.role === 'customer';
    chip.classList.toggle('hidden', !show);
  }
  new MutationObserver(vis).observe(appView, { attributes: true, attributeFilter: ['class'] });

  /* ---------- hook into checkout ---------- */
  const _place = window.handlePlaceOrder;
  window.handlePlaceOrder = function (e) {
    if ($('payment-mode').value !== 'Wallet') return _place(e);
    e.preventDefault();
    if (!cart.length) return;
    const need = totals().total;
    if (need > wallet.balance) {
      toast(`Not enough balance. Add ${money(need - wallet.balance)} more.`);
      openWallet();
      return;
    }
    const before = orders.length;
    _place(e);
    if (orders.length > before) {
      const o = orders[0];
      debit(o.total, `Paid for ${o.id}`, o.id);
      toast(`${money(o.total)} paid from wallet`);
    }
  };

  /* ---------- refunds ---------- */
  function refund(o) {
    if (!o || o.payment !== 'Wallet') return;
    if (wallet.txns.some(t => t.type === 'credit' && t.order === o.id)) return;
    credit(o.total, `Refund for ${o.id}`, o.id);
    toast(`${money(o.total)} refunded to your wallet`);
  }
  const _cancel = window.cancelOrder;
  window.cancelOrder = function (id) {
    const o = orders.find(x => x.id === id);
    const was = o && o.status;
    _cancel(id);
    if (o && was === 'PLACED' && o.status === 'CANCELLED') refund(o);
  };
  const _status = window.updateOrderStatus;
  window.updateOrderStatus = function (id, s) {
    const o = orders.find(x => x.id === id);
    const was = o && o.status;
    _status(id, s);
    if (o && was !== 'CANCELLED' && o.status === 'CANCELLED') refund(o);
  };

  /* keep the payment option fresh whenever the cart re-renders */
  const _renderCart = window.renderCart;
  window.renderCart = function () { _renderCart(); syncOption(); };

  refresh();
  vis();
})();
