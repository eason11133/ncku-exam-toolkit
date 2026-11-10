// The upstream IME renders candidates as table rows but only handles keyboard selection.
// Delegate clicks so mouse and touch users can select the same numbered candidates.
const candidateList = document.getElementById('candidates');
const inputArea = document.getElementById('text_area');

function candidateRow(target) {
  const row = target instanceof Element ? target.closest('tr') : null;
  return row && candidateList.contains(row) && row.querySelector('.keyCap') ? row : null;
}

function selectCandidate(row) {
  const key = row.querySelector('.keyCap')?.textContent.trim();
  if (!key || !window.example?.controller) return;
  window.example.controller.simpleKeyboardEvent(key, false, false);
  inputArea.focus();
}

candidateList.addEventListener('click', event => {
  const row = candidateRow(event.target);
  if (row) selectCandidate(row);
});

candidateList.addEventListener('keydown', event => {
  if (event.key !== 'Enter' && event.key !== ' ') return;
  const row = candidateRow(event.target);
  if (!row) return;
  event.preventDefault();
  selectCandidate(row);
});

const candidateObserver = new MutationObserver(() => {
  for (const row of candidateList.querySelectorAll('tr')) {
    const key = row.querySelector('.keyCap')?.textContent.trim();
    const label = row.querySelector('.candidate')?.textContent.trim();
    if (!key || !label) continue;
    row.tabIndex = 0;
    row.setAttribute('role', 'button');
    row.setAttribute('aria-label', `選擇候選字 ${key} ${label}`);
  }
});
candidateObserver.observe(candidateList, { childList: true, subtree: true });
