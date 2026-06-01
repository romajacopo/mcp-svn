/**
 * Validates the REAL JenkinsApiAdapter against a live Jenkins (docker compose).
 *   docker compose up -d jenkins
 *   npx tsx scripts/validate-jenkins.ts
 *
 * Seeds a freestyle job that fails while printing a maven-style error line,
 * triggers a build, then exercises the adapter's read paths + BuildAnalyzer
 * against the real console log.
 */
import { JenkinsApiAdapter } from "../services/mcp-jenkins/src/adapters/outbound/jenkins-api.adapter.js";
import { BuildAnalyzerService } from "../services/mcp-jenkins/src/domain/services/build-analyzer.service.js";

const BASE = process.env.JENKINS_URL ?? "http://localhost:8080";
const USER = process.env.JENKINS_USER ?? "admin";
const PASS = process.env.JENKINS_TOKEN ?? "admin";
const AUTH = "Basic " + Buffer.from(`${USER}:${PASS}`).toString("base64");
const JOB = "math-app";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const JOB_XML = `<?xml version='1.1' encoding='UTF-8'?>
<project>
  <description>EAR red-build validation job</description>
  <keepDependencies>false</keepDependencies>
  <properties/>
  <scm class="hudson.scm.NullSCM"/>
  <canRoam>true</canRoam>
  <disabled>false</disabled>
  <triggers/>
  <concurrentBuild>false</concurrentBuild>
  <builders>
    <hudson.tasks.Shell>
      <command>echo "[INFO] Building math-app 1.0.0"
echo "[ERROR] /workspace/src/main/java/com/example/service/MathService.java:[9,27] cannot find symbol"
echo "[ERROR]   symbol:   method add(int,int)"
echo "[INFO] BUILD FAILURE"
exit 1</command>
    </hudson.tasks.Shell>
  </builders>
  <publishers/>
  <buildWrappers/>
</project>`;

async function waitForJenkins(attempts = 60): Promise<void> {
  for (let i = 1; i <= attempts; i++) {
    try {
      const res = await fetch(`${BASE}/api/json`, { headers: { Authorization: AUTH } });
      if (res.ok) return;
    } catch {
      /* not up yet */
    }
    process.stdout.write(`  waiting for jenkins (${i}/${attempts})\r`);
    await sleep(3000);
  }
  throw new Error("jenkins did not become ready in time");
}

async function getCrumb(): Promise<Record<string, string>> {
  try {
    const res = await fetch(`${BASE}/crumbIssuer/api/json`, { headers: { Authorization: AUTH } });
    if (!res.ok) return {};
    const data = (await res.json()) as { crumbRequestField: string; crumb: string };
    const headers: Record<string, string> = { [data.crumbRequestField]: data.crumb };
    // The crumb is bound to the web session — carry the JSESSIONID cookie too.
    const setCookie = res.headers.get("set-cookie");
    const jsession = setCookie?.match(/JSESSIONID[^;]*/)?.[0];
    if (jsession) headers["Cookie"] = jsession;
    return headers;
  } catch {
    return {};
  }
}

async function seedJob(crumb: Record<string, string>): Promise<void> {
  const exists = await fetch(`${BASE}/job/${JOB}/api/json`, { headers: { Authorization: AUTH } });
  if (exists.ok) {
    console.log(`• job '${JOB}' already exists`);
    return;
  }
  const res = await fetch(`${BASE}/createItem?name=${JOB}`, {
    method: "POST",
    headers: { Authorization: AUTH, "Content-Type": "application/xml", ...crumb },
    body: JOB_XML,
  });
  if (!res.ok) throw new Error(`createItem failed: ${res.status} ${await res.text()}`);
  console.log(`• seeded failing job '${JOB}'`);
}

async function triggerAndWait(crumb: Record<string, string>): Promise<void> {
  const before = await lastBuildNumber();
  const res = await fetch(`${BASE}/job/${JOB}/build`, {
    method: "POST",
    headers: { Authorization: AUTH, ...crumb },
  });
  if (!res.ok && res.status !== 201) throw new Error(`trigger failed: ${res.status}`);
  console.log("• build triggered, waiting for completion…");

  for (let i = 0; i < 40; i++) {
    await sleep(3000);
    const res2 = await fetch(`${BASE}/job/${JOB}/lastBuild/api/json`, { headers: { Authorization: AUTH } });
    if (res2.ok) {
      const b = (await res2.json()) as { number: number; result: string | null; building: boolean };
      if (b.number > before && b.result && !b.building) {
        console.log(`• build #${b.number} finished: ${b.result}`);
        return;
      }
    }
  }
  throw new Error("build did not finish in time");
}

async function lastBuildNumber(): Promise<number> {
  const res = await fetch(`${BASE}/job/${JOB}/lastBuild/api/json`, { headers: { Authorization: AUTH } });
  if (!res.ok) return 0;
  const b = (await res.json()) as { number: number };
  return b.number ?? 0;
}

async function main() {
  console.log(`• connecting to Jenkins at ${BASE}…`);
  await waitForJenkins();
  console.log("• connected.                       ");

  const jenkins = new JenkinsApiAdapter({ baseUrl: BASE, user: USER, token: PASS });

  // read path 1: list jobs (connectivity + auth via the adapter)
  const crumb = await getCrumb();
  await seedJob(crumb);
  await triggerAndWait(crumb);

  const jobs = await jenkins.getJobs();
  console.log("• adapter.getJobs():", jobs);

  const failed = await jenkins.getFailedBuilds(JOB, 5);
  console.log(`• adapter.getFailedBuilds('${JOB}'): ${failed.length} failed build(s)`);

  const last = await jenkins.getLastBuild(JOB);
  console.log(`• adapter.getLastBuild('${JOB}'): #${last.buildNumber} status=${last.status}`);

  // the real test: analyze the real console log via the domain service
  const analyzer = new BuildAnalyzerService(jenkins);
  const analysis = await analyzer.analyzeBuild(JOB, last.buildNumber);
  console.log("• BuildAnalyzer parsed errors from the REAL console log:");
  for (const e of analysis.errors) {
    console.log(`    ${e.file}:${e.line} [${e.category}] ${e.message}`);
  }

  const ok =
    jobs.includes(JOB) &&
    last.status === "FAILURE" &&
    analysis.errors.some((e) => e.category === "COMPILATION" && e.file.includes("MathService.java") && e.line === 9);

  console.log(ok ? "\n✓ JenkinsApiAdapter validated against real Jenkins" : "\n✗ validation FAILED");
  process.exitCode = ok ? 0 : 1;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
