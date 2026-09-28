const SUCCESS_PATTERN = /model loaded|loaded .*engine|engine ready/i;
const ERROR_PATTERN = /could not|failed|failure|error|unavailable|cancelled|no model source/i;

export function createStatusNotification({row, message, dismiss, successDuration = 3000}) {
  let timer = 0;

  const hide = () => {
    clearTimeout(timer);
    row?.classList.add('status-hidden');
    if (row) row.hidden = true;
  };

  if (dismiss) dismiss.onclick = hide;

  return text => {
    if (!row || !message) return;
    clearTimeout(timer);
    message.textContent = text;
    row.dataset.kind = ERROR_PATTERN.test(text) ? 'error' : SUCCESS_PATTERN.test(text) ? 'success' : 'progress';
    row.hidden = false;
    row.classList.remove('status-hidden');
    if (row.dataset.kind === 'success') timer = setTimeout(hide, successDuration);
  };
}
