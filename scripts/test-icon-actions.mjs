import assert from 'node:assert/strict';
import { ESLint } from 'eslint';

const lint = new ESLint();
const samples = [
  ['<button><X /></button>', 1],
  ['<button>{visible ? <EyeOff /> : <Eye />}</button>', 1],
  ['<button><Heart /><span>{reaction.likesCount}</span></button>', 1],
  ['<a href="/"><X /></a>', 1],
  ['<div onClick={close}><X /></div>', 1],
  ['<button><X />{t("common.close")}</button>', 0],
  ['<button><X />{"Close"}</button>', 0],
  ['<IconButton label="Close"><X /></IconButton>', 0],
  ['<IconButton asChild label="Visit"><a href="/"><X /></a></IconButton>', 0],
  ['<IconButton label="Close"><X /><span>{t("common.close")}</span></IconButton>', 1],
  ['<IconButton label="Close" showTooltip><X />Close</IconButton>', 1],
  ['<IconButton label="Close" showTooltip={true}><X />Close</IconButton>', 1],
  ['<IconButton label="Close" showTooltip={false}><X />Close</IconButton>', 0],
  ['<IconButton label="Close" showTooltip={collapsed}><X />{!collapsed && <span>{item.label}</span>}</IconButton>', 0],
  ['<IconButton label="Close" showTooltip={isBelow("sm")}><X /><span className="hidden sm:inline">{t("common.close")}</span></IconButton>', 0],
  ['<IconButton label="Like"><Heart /><span>{reaction.likesCount.toLocaleString()}</span></IconButton>', 0],
  ['<IconButton label="Theme">{theme === "dark" ? <Eye /> : <EyeOff />}</IconButton>', 0],
  ['<IconButton asChild label="Visit"><a href="/"><X />Visit</a></IconButton>', 1],
];
for (const [markup, expected] of samples) {
  const [result] = await lint.lintText(`import { X, Eye, EyeOff, Heart } from 'lucide-react'; const sample = ${markup};`, {
    filePath: 'frontend/src/icon-action-rule-fixture.tsx',
  });
  const findings = result.messages.filter(message => message.ruleId === 'gemigo-ui/icon-actions');
  assert.equal(findings.length, expected, markup);
}
const results = await lint.lintFiles(['frontend/src/**/*.tsx']);
const findings = results.flatMap(result => result.messages.filter(message => message.ruleId === 'gemigo-ui/icon-actions')
  .map(message => `${result.filePath}:${message.line} ${message.message}`));
assert.deepEqual(findings, []);
console.log('Icon action rule passed: bare icon actions and uncontrolled named tooltips rejected; responsive/collapsed policies and icon counts accepted; frontend inventory clean.');
