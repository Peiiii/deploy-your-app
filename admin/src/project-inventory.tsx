import { categoryLabels, languageLabel, type Inventory } from './project-inventory-data';

const number = (n: number) => n.toLocaleString('zh-CN');
const percent = (n: number, total: number) => (total ? `${((n / total) * 100).toFixed(1)}%` : '—');

export default function ProjectInventory({ data }: { data: Inventory }) {
  const { summary, categories, languages } = data;
  const unknownLanguages = summary.total - summary.languageKnown;
  return (
    <section className="project-inventory" aria-label="应用存量统计">
      <div className="spread">
        <h2>应用存量</h2>
        <span className="muted">全部未删除应用 · 当前快照</span>
      </div>
      <div className="metrics business-metrics">
        {[
          [
            '有效应用',
            summary.total,
            `${number(summary.live)} 已上线 · ${number(summary.total - summary.live)} 未上线`,
          ],
          [
            '设为公开',
            summary.public,
            `${percent(summary.public, summary.total)} · 其中 ${number(summary.publicLive)} 个已上线且有访问地址`,
          ],
          ['设为非公开', summary.private, `${percent(summary.private, summary.total)} 的有效应用`],
          [
            '已确认语言',
            summary.languageKnown,
            `${percent(summary.languageKnown, summary.total)} · ${number(unknownLanguages)} 个未确认`,
          ],
        ].map(([label, value, hint]) => (
          <article className="metric" key={String(label)}>
            <span>{label}</span>
            <strong>{number(Number(value))}</strong>
            <small>{hint}</small>
          </article>
        ))}
      </div>
      <div className="two-columns inventory-breakdowns">
        {[
          {
            title: '应用主分类',
            rows: categories,
            label: (name: string) => categoryLabels[name] || name,
            hint: '每个应用只计一次；未知或空分类归入其他。教学游戏的发现标签不重复计数。',
          },
          {
            title: '应用界面语言',
            rows: [...languages, { name: 'und', total: unknownLanguages }],
            label: languageLabel,
            hint: '实际应用语言，不含介绍翻译。多语言应用在各语言下分别计一次，比例之和可能超过 100%。',
          },
        ].map(({ title, rows, label, hint }) => (
          <article className="panel" key={title}>
            <h3>{title}</h3>
            <div className="inventory-distribution">
              {rows.map(({ name, total }) => (
                <div className="inventory-distribution-row" key={name}>
                  <div className="spread">
                    <span>{label(name)}</span>
                    <strong>
                      {number(total)} <small>{percent(total, summary.total)}</small>
                    </strong>
                  </div>
                  <div className="track">
                    <i style={{ width: `${summary.total ? (total / summary.total) * 100 : 0}%` }} />
                  </div>
                </div>
              ))}
            </div>
            {!summary.total && <p className="muted">当前没有有效应用。</p>}
            <p className="footnote">{hint}</p>
          </article>
        ))}
      </div>
      <p className="caption">
        统计不随下面的列表筛选变化。公开设置未记录：{number(summary.visibilityUnknown)}{' '}
        个；不当作非公开。非公开只控制平台展示，原链接访问仍遵循现有应用规则。
      </p>
    </section>
  );
}
