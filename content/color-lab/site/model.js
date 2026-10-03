export const LEVELS = [
  {
    name: '阳光黄',
    channels: [100, 100, 0],
    hint: '试着用两束光，调出黄色。',
    lesson: '红光 + 绿光 = 黄光。先让蓝光休息一下。',
  },
  {
    name: '海水青',
    channels: [0, 100, 100],
    hint: '像一片清亮的海水，哪两束光能做到？',
    lesson: '绿光 + 蓝光 = 青光。这次不需要红光。',
  },
  {
    name: '电光品红',
    channels: [100, 0, 100],
    hint: '大胆的品红色，少一束光就能出现。',
    lesson: '红光 + 蓝光 = 品红光。绿光让它渐渐变白。',
  },
  {
    name: '落日橙',
    channels: [100, 55, 20],
    hint: '不只有开和关。试试给每束光不同的通道值。',
    lesson: '红光占主导，加入一些绿光和少量蓝光，可以调出橙色。',
  },
  {
    name: '暮色紫',
    channels: [55, 35, 90],
    hint: '最后一关，把黄昏的那一点紫留下。',
    lesson: '蓝光占主导，配合红光与少量绿光，得到这抹暮色。',
  },
];

export function normalizeChannels(channels) {
  return channels.map((value) => Math.round(Math.max(0, Math.min(100, Number(value) || 0))));
}

export function toRgb(channels) {
  return normalizeChannels(channels).map((value) => Math.round((value * 255) / 100));
}

export function toHex(channels) {
  return (
    '#' +
    toRgb(channels)
      .map((value) => value.toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase()
  );
}

export function compareMix(channels, target) {
  const normalized = normalizeChannels(channels);
  const differences = normalized.map((value, index) => value - target[index]);
  const distance = Math.sqrt(differences.reduce((sum, value) => sum + value * value, 0));
  const score = Math.round(100 * (1 - distance / Math.sqrt(30000)));
  const channel = differences.reduce(
    (best, value, index) => (Math.abs(value) > Math.abs(differences[best]) ? index : best),
    0
  );
  return {
    score,
    solved: differences.every((value) => Math.abs(value) <= 6),
    channel,
    direction: differences[channel] > 0 ? 'down' : 'up',
  };
}

export function recipeFromSearch(search) {
  const params = new URLSearchParams(search);
  const values = ['r', 'g', 'b'].map((key) => params.get(key));
  if (values.some((value) => value === null || !/^\d{1,3}$/.test(value))) return null;
  const numbers = values.map(Number);
  return numbers.some((value) => value > 100) ? null : numbers;
}

export function recipeUrl(href, channels) {
  const url = new URL(href);
  url.search = '';
  url.hash = '';
  normalizeChannels(channels).forEach((value, index) =>
    url.searchParams.set(['r', 'g', 'b'][index], String(value))
  );
  return url.href;
}

export function explainColor(channels) {
  const [r, g, b] = normalizeChannels(channels);
  if (r === 0 && g === 0 && b === 0)
    return {
      name: '黑色',
      title: '没有光，就是黑。',
      copy: '三个通道都为 0，屏幕不再加入颜色。试着只打开红光，再一点点加入绿光。',
    };
  if (r === g && g === b)
    return r === 100
      ? {
          name: '白色',
          title: '三束光，汇成白色。',
          copy: '红、绿、蓝通道都开到最大，重叠处就是白色。把蓝光调到 0，看看剩下的两束光会发生什么。',
        }
      : {
          name: '灰色',
          title: '相同的配方，不同的明暗。',
          copy: '三个通道保持相等，会得到灰色。一起增加通道值，颜色就向白色靠近。',
        };
  if (b === 0 && r === g && r > 0)
    return {
      name: '黄色',
      title: '红光 + 绿光，竟然是黄。',
      copy: '这是光的加色混合。黄色不一定需要一束黄光：相等的红、绿通道也能在屏幕上组合出黄色。',
    };
  if (r === 0 && g === b && g > 0)
    return {
      name: '青色',
      title: '绿光与蓝光，遇见青色。',
      copy: '把红光关掉，保持绿、蓝通道相等，重叠处会出现青色。增加一点红光，观察它怎样变浅。',
    };
  if (g === 0 && r === b && r > 0)
    return {
      name: '品红色',
      title: '红光 + 蓝光，不只是紫。',
      copy: '相等的红、蓝通道会形成品红色。试着减少红光，看看颜色如何偏向蓝色。',
    };
  if (r > 0 && g === 0 && b === 0)
    return {
      name: '红色',
      title: '现在，只有一束红光。',
      copy: '一束光也能改变明暗。慢慢加入绿光，观察红色如何经过橙色，向黄色靠近。',
    };
  if (g > 0 && r === 0 && b === 0)
    return {
      name: '绿色',
      title: '留下一束绿光。',
      copy: '试着加入蓝光，看看重叠处变成什么颜色。光的混合，不需要颜料。',
    };
  if (b > 0 && r === 0 && g === 0)
    return {
      name: '蓝色',
      title: '只剩蓝光，也很好看。',
      copy: '加入红光，试着找到品红色。再加入一点绿光，会发生什么？',
    };
  return {
    name: '你的专属色',
    title: '改变比例，就有新的可能。',
    copy: `当前配方是红 ${r}、绿 ${g}、蓝 ${b}。试着只改变其中一个通道，观察它对颜色的影响。`,
  };
}
