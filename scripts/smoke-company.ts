/**
 * Read-only smoke test against COMPANY Jenkins + SVN.
 *   set -a; source .env; set +a
 *   npx tsx scripts/smoke-company.ts
 *
 * - Fetches build console log + test report from the configured Jenkins build.
 * - Parses errors with BuildAnalyzerService logic (via parseMavenLog).
 * - Runs `svn info` and `svn log` against the configured SVN repo via SvnCliAdapter.
 */
import { parseMavenLog } from "../services/mcp-jenkins/src/domain/services/log-error-parser.js";
import { SvnCliAdapter } from "../services/mcp-svn/src/adapters/outbound/svn-cli.adapter.js";

// Company Jenkins serves a self-signed cert.
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const JENKINS_URL = required("JENKINS_URL");
const JENKINS_USER = required("JENKINS_USER");
const JENKINS_TOKEN = required("JENKINS_TOKEN");
const JENKINS_TEST_JOB = process.env.JENKINS_TEST_JOB ?? "smoke-test/trunk-smoke-int-test-spring-context-bean-loading";
const JENKINS_TEST_BUILD = Number(process.env.JENKINS_TEST_BUILD ?? 20619);

const SVN_URL = required("SVN_URL");
const SVN_USER = required("SVN_USER");
const SVN_PASSWORD = required("SVN_PASSWORD");

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`missing env ${name} — did you 'source .env'?`);
  return v;
}

// Jenkins folder jobs use /job/<folder>/job/<name>/... — segments encoded individually.
function jobPath(name: string): string {
  return name.split("/").map((s) => `/job/${encodeURIComponent(s)}`).join("");
}

const auth = "Basic " + Buffer.from(`${JENKINS_USER}:${JENKINS_TOKEN}`).toString("base64");
async function jget(path: string): Promise<Response> {
  return fetch(`${JENKINS_URL}${path}`, { headers: { Authorization: auth } });
}

async function probeJenkins() {
  console.log("\n━━ Jenkins ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`url:   ${JENKINS_URL}`);
  console.log(`user:  ${JENKINS_USER}`);
  console.log(`build: ${JENKINS_TEST_JOB} #${JENKINS_TEST_BUILD}`);

  const meta = await jget(`${jobPath(JENKINS_TEST_JOB)}/${JENKINS_TEST_BUILD}/api/json?tree=number,result,building,duration,timestamp,url`);
  if (!meta.ok) {
    console.log(`  ✗ build meta HTTP ${meta.status}`);
    return;
  }
  const m = (await meta.json()) as { number: number; result: string; duration: number; url: string };
  console.log(`  ✓ build #${m.number} result=${m.result} dur=${(m.duration / 1000).toFixed(1)}s`);

  const logRes = await jget(`${jobPath(JENKINS_TEST_JOB)}/${JENKINS_TEST_BUILD}/consoleText`);
  if (!logRes.ok) {
    console.log(`  ✗ consoleText HTTP ${logRes.status}`);
    return;
  }
  const log = await logRes.text();
  console.log(`  ✓ consoleText: ${log.length.toLocaleString()} bytes`);
  const errors = parseMavenLog(log);
  console.log(`  → parseMavenLog found ${errors.length} error(s)`);
  for (const e of errors.slice(0, 8)) {
    console.log(`     ● ${e.file}:${e.line}  [${e.category}] ${e.message.slice(0, 100)}`);
  }
  if (errors.length > 8) console.log(`     … +${errors.length - 8} more`);

  const trRes = await jget(`${jobPath(JENKINS_TEST_JOB)}/${JENKINS_TEST_BUILD}/testReport/api/json?tree=totalCount,failCount,skipCount`);
  if (trRes.ok) {
    const tr = (await trRes.json()) as { totalCount: number; failCount: number; skipCount: number };
    console.log(`  ✓ testReport: total=${tr.totalCount} fail=${tr.failCount} skip=${tr.skipCount}`);
  } else {
    console.log(`  · testReport HTTP ${trRes.status} (build may have no JUnit report)`);
  }
}

async function probeSvn() {
  console.log("\n━━ SVN ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`url:  ${SVN_URL}`);
  console.log(`user: ${SVN_USER}`);
  const svn = new SvnCliAdapter({ url: SVN_URL, user: SVN_USER, password: SVN_PASSWORD });

  const log = await svn.log(".", 3);
  console.log(`  ✓ svn log: ${log.length} commit(s)`);
  for (const c of log) {
    const msg = c.message.split("\n")[0].slice(0, 80);
    console.log(`     r${c.revision} | ${c.author} | ${new Date(c.date).toISOString().slice(0, 10)} | ${msg}`);
  }

  const top = await svn.list(".");
  console.log(`  ✓ svn list root: ${top.length} entries → ${top.slice(0, 6).join(", ")}${top.length > 6 ? ", …" : ""}`);
}

async function main() {
  try {
    await probeJenkins();
  } catch (err) {
    console.error("Jenkins probe failed:", err);
  }
  try {
    await probeSvn();
  } catch (err) {
    console.error("SVN probe failed:", err);
  }
  console.log("\nDone.");
}

main();
