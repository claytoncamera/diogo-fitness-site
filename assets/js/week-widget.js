// "Fit your week" widget: pick how many days you can train, see where they land in a normal week.
import { track } from './track.js?v=a5fa2226';

const root = document.querySelector('[data-week]');
if (root) {
  const data = JSON.parse(root.querySelector('[data-week-data]').textContent);
  const days = [...root.querySelectorAll('.week__day')];
  const title = root.querySelector('[data-week-title]');
  const text = root.querySelector('[data-week-text]');

  const render = (n) => {
    const opt = data.options[n];
    if (!opt) return;
    days.forEach((el, i) => {
      const on = opt.train.includes(i);
      el.classList.toggle('is-train', on);
      el.querySelector('.week__slot-label').textContent = on ? 'Train' : 'Life';
    });
    title.textContent = opt.title;
    text.textContent = opt.text;
  };

  root.addEventListener('change', (e) => {
    if (e.target.name !== 'week-days') return;
    render(e.target.value);
    track('week_widget', { days: e.target.value });
  });
  render(data.default);
}
