import {
  LEVELS,
  toRgb,
  toHex,
  compareMix,
  recipeFromSearch,
  recipeUrl,
  explainColor,
} from './model.js';

const $ = (id) => document.getElementById(id);
const channelIds = ['red', 'green', 'blue'];
const channelLabels = ['红光', '绿光', '蓝光'];
const state = {
  mode: 'explore',
  explore: recipeFromSearch(location.search) || [100, 100, 100],
  challenge: [40, 40, 40],
  level: 0,
  solved: false,
  completed: false,
  attempts: 0,
  totalAttempts: 0,
  feedback: '',
};
let toastTimer;

function channels() {
  return state.mode === 'explore' ? state.explore : state.challenge;
}

function showToast(text) {
  clearTimeout(toastTimer);
  $('toast').textContent = text;
  $('toast').hidden = false;
  toastTimer = setTimeout(() => {
    $('toast').hidden = true;
  }, 2600);
}

function render() {
  const current = channels();
  const rgb = toRgb(current);
  const explanation = explainColor(current);
  const challenge = state.mode === 'challenge';
  document.documentElement.style.setProperty('--mixed', `rgb(${rgb.join(' ')})`);
  $('mode-explore').setAttribute('aria-selected', String(!challenge));
  $('mode-challenge').setAttribute('aria-selected', String(challenge));
  $('mode-explore').tabIndex = challenge ? -1 : 0;
  $('mode-challenge').tabIndex = challenge ? 0 : -1;
  $('workspace-note').textContent = challenge
    ? '凭眼睛观察，用三束光调色。'
    : '试一试，关掉一束光。';
  $('mix-result').hidden = challenge;
  $('challenge-head').hidden = !challenge;
  $('explore-actions').hidden = challenge;
  $('challenge-actions').hidden = !challenge || state.completed;
  $('completion').hidden = !challenge || !state.completed;
  $('invite-challenge').textContent = challenge
    ? '回到自由混光，继续探索 ↗'
    : '试试凭眼睛调出五种颜色 ↗';
  channelIds.forEach((id, index) => {
    const input = $(id);
    input.value = String(current[index]);
    input.style.setProperty('--fill', current[index] + '%');
    input.setAttribute('aria-valuetext', `${channelLabels[index]}通道值 ${current[index]}`);
    input.disabled = challenge && (state.solved || state.completed);
    $(id + '-output').textContent = String(current[index]);
    const color = [0, 0, 0];
    color[index] = rgb[index];
    $(id + '-disc').style.backgroundColor = `rgb(${color.join(' ')})`;
  });
  $('light-stage').setAttribute(
    'aria-label',
    `红光 ${current[0]}，绿光 ${current[1]}，蓝光 ${current[2]}，混合色 ${toHex(current)}`
  );
  $('color-name').textContent = explanation.name;
  $('hex-value').textContent = toHex(current);
  $('discovery-name').textContent = explanation.title;
  $('discovery-copy').textContent = explanation.copy;
  document
    .querySelectorAll('[data-preset]')
    .forEach((button) =>
      button.setAttribute('aria-pressed', String(button.dataset.preset === current.join(',')))
    );
  if (!challenge) return;
  const level = LEVELS[state.level];
  const comparison = compareMix(current, level.channels);
  $('target-swatch').style.backgroundColor = toHex(level.channels);
  $('target-name').textContent = level.name;
  $('level-label').textContent = `挑战 ${String(state.level + 1).padStart(2, '0')} / 05`;
  $('attempt-label').textContent = state.attempts ? `已提交 ${state.attempts} 次` : '还没提交';
  $('score-label').textContent = `${comparison.score}% 接近`;
  $('level-dots').replaceChildren(
    ...LEVELS.map((item, index) => {
      const dot = document.createElement('i');
      dot.className =
        index < state.level || (index === state.level && state.solved)
          ? 'done'
          : index === state.level
            ? 'current'
            : '';
      dot.setAttribute('aria-hidden', 'true');
      return dot;
    })
  );
  $('level-dots').setAttribute(
    'aria-label',
    `已完成 ${state.completed ? 5 : state.level + Number(state.solved)} / 5 关`
  );
  $('submit-mix').hidden = state.solved;
  $('next-level').hidden = !state.solved;
  $('next-level').textContent = state.level === 4 ? '看看你的成果 →' : '下一种颜色 →';
  $('challenge-feedback').textContent = state.feedback || level.hint;
  $('challenge-feedback').classList.toggle('success', state.solved);
  if (state.completed) {
    $('completion-text').textContent =
      `用 ${state.totalAttempts} 次提交，完成了五种颜色。你也可以回到自由混光，继续发现自己的配方。`;
    $('earned-colors').replaceChildren(
      ...LEVELS.map((item) => {
        const chip = document.createElement('i');
        chip.style.backgroundColor = toHex(item.channels);
        chip.title = item.name;
        return chip;
      })
    );
  }
}

function setMode(mode) {
  state.mode = mode;
  render();
}

channelIds.forEach((id, index) =>
  $(id).addEventListener('input', (event) => {
    channels()[index] = Number(event.target.value);
    if (state.mode === 'challenge') state.feedback = '';
    render();
  })
);
$('mode-explore').addEventListener('click', () => setMode('explore'));
$('mode-challenge').addEventListener('click', () => setMode('challenge'));
['explore', 'challenge'].forEach((mode) => {
  $('mode-' + mode).addEventListener('keydown', (event) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const nextMode =
      event.key === 'Home'
        ? 'explore'
        : event.key === 'End'
          ? 'challenge'
          : mode === 'explore'
            ? 'challenge'
            : 'explore';
    setMode(nextMode);
    $('mode-' + nextMode).focus();
  });
});
document.querySelectorAll('[data-preset]').forEach((button) =>
  button.addEventListener('click', () => {
    state.explore = button.dataset.preset.split(',').map(Number);
    render();
  })
);
$('reset').addEventListener('click', () => {
  state.explore = [100, 100, 100];
  render();
});
$('random-color').addEventListener('click', () => {
  state.explore = channelIds.map(() => Math.floor(Math.random() * 101));
  render();
});
$('submit-mix').addEventListener('click', () => {
  if (state.solved || state.completed) return;
  state.attempts += 1;
  state.totalAttempts += 1;
  const level = LEVELS[state.level];
  const comparison = compareMix(state.challenge, level.channels);
  if (comparison.solved) {
    state.solved = true;
    state.feedback = `调出来了！${level.lesson} 目标配方：${level.channels.join(' / ')}。`;
  } else {
    state.feedback = `${comparison.score}% 接近。试着把${channelLabels[comparison.channel]}${comparison.direction === 'down' ? '调低' : '调高'}一点，再看一看。`;
  }
  render();
  if (state.solved) $('next-level').focus({ preventScroll: true });
});
$('next-level').addEventListener('click', () => {
  if (!state.solved) return;
  if (state.level === LEVELS.length - 1) {
    state.completed = true;
    render();
    $('completion').scrollIntoView({
      behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
      block: 'center',
    });
    $('restart').focus({ preventScroll: true });
    return;
  }
  state.level += 1;
  state.solved = false;
  state.attempts = 0;
  state.feedback = '';
  state.challenge = [40, 40, 40];
  render();
  $('red').focus({ preventScroll: true });
});
$('restart').addEventListener('click', () => {
  Object.assign(state, {
    challenge: [40, 40, 40],
    level: 0,
    solved: false,
    completed: false,
    attempts: 0,
    totalAttempts: 0,
    feedback: '',
  });
  render();
  $('workspace').scrollIntoView({
    behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
    block: 'start',
  });
});
$('invite-challenge').addEventListener('click', () => {
  setMode(state.mode === 'challenge' ? 'explore' : 'challenge');
  $('workspace').scrollIntoView({
    behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
    block: 'start',
  });
});

async function copy(text) {
  try {
    if (!navigator.clipboard?.writeText) return false;
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
$('copy-color').addEventListener('click', async () => {
  const value = toHex(channels());
  if (await copy(value)) showToast(`已复制 ${value}`);
  else showToast(`颜色代码：${value}，可以选中配方里的代码复制。`);
});
$('share').addEventListener('click', async () => {
  const url = recipeUrl(location.href, channels());
  $('share-url').value = url;
  $('share-note').textContent = '也可以选中上面的链接，手动复制。';
  $('share-dialog').showModal();
  if (await copy(url)) $('share-note').textContent = '已复制链接，可以直接粘贴分享。';
});
$('copy-share').addEventListener('click', async () => {
  if (await copy($('share-url').value)) {
    $('share-note').textContent = '已复制链接，可以直接粘贴分享。';
    showToast('配方链接已复制');
  } else {
    $('share-url').focus();
    $('share-url').select();
    $('share-note').textContent = '浏览器没有开放剪贴板，请手动复制选中的链接。';
  }
});
$('help-open').addEventListener('click', () => $('help-dialog').showModal());
$('sources-open').addEventListener('click', () => $('sources-dialog').showModal());
document
  .querySelectorAll('[data-close]')
  .forEach((button) => button.addEventListener('click', () => $(button.dataset.close).close()));
document.querySelectorAll('dialog').forEach((dialog) =>
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) {
      const rect = dialog.getBoundingClientRect();
      if (
        event.clientX < rect.left ||
        event.clientX > rect.right ||
        event.clientY < rect.top ||
        event.clientY > rect.bottom
      )
        dialog.close();
    }
  })
);
render();
