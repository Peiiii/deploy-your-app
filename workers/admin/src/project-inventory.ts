// Current metadata only. Discovery's game tag overlap does not change primary category.
export const categorySql = `CASE WHEN p.category IN ('Education','Games','Productivity','Creative','Development') THEN p.category ELSE 'Other' END`;
const languageArray = `CASE WHEN json_valid(p.app_language) THEN
  CASE WHEN json_extract(p.app_language,'$.source') IN ('author','detected')
  AND json_type(p.app_language,'$.languages')='array' THEN json_extract(p.app_language,'$.languages') ELSE '[]' END
  ELSE '[]' END`;
const validLanguage = `lang.type='text' AND lang.key<8 AND length(lang.value) IN (2,3)
  AND lang.value NOT GLOB '*[^a-z]*' AND lang.value<>'und'`;
export const languageExistsSql = `EXISTS (SELECT 1 FROM json_each(${languageArray}) lang WHERE ${validLanguage})`;
export const languageMatchSql = `EXISTS (SELECT 1 FROM json_each(${languageArray}) lang WHERE ${validLanguage} AND lang.value=?)`;
export const languageListSql = `(SELECT json_group_array(value) FROM (SELECT DISTINCT lang.value AS value FROM json_each(${languageArray}) lang WHERE ${validLanguage} ORDER BY value))`;

export const projectInventory = async (db: D1Database) => {
  const active = 'COALESCE(p.is_deleted,0)=0';
  const result = await db.batch<Record<string, string | number | null>>([
    db.prepare(`SELECT COUNT(*) AS total,COALESCE(SUM(p.is_public=1),0) AS public,
      COALESCE(SUM(p.is_public=0),0) AS private,
      COALESCE(SUM(p.is_public IS NULL OR p.is_public NOT IN (0,1)),0) AS visibilityUnknown,
      COALESCE(SUM(p.status='Live'),0) AS live,
      COALESCE(SUM(p.is_public=1 AND p.status='Live' AND p.url IS NOT NULL AND TRIM(p.url)!=''),0) AS publicLive,
      COALESCE(SUM(${languageExistsSql}),0) AS languageKnown FROM projects p WHERE ${active}`),
    db.prepare(
      `SELECT ${categorySql} AS name,COUNT(*) AS total FROM projects p WHERE ${active} GROUP BY ${categorySql} ORDER BY total DESC,name`
    ),
    db.prepare(`SELECT lang.value AS name,COUNT(DISTINCT p.id) AS total
      FROM projects p,json_each(${languageArray}) lang WHERE ${active} AND ${validLanguage} GROUP BY lang.value ORDER BY total DESC,name`),
  ]);
  return {
    summary: result[0].results[0],
    categories: result[1].results,
    languages: result[2].results,
  };
};
