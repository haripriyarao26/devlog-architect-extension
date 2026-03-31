import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

export interface CommitBundle {
  hash: string;
  subject: string;
  body: string;
  diff: string;
}

const COMMIT_SEP = "\n---COMMIT---\n";

export async function getLastNCommits(
  repoRoot: string,
  count: number
): Promise<CommitBundle[]> {
  const { stdout: logOut } = await execFileAsync(
    "git",
    [
      "-C",
      repoRoot,
      "log",
      `-${count}`,
      "--pretty=format:%H%n%s%n%b" + COMMIT_SEP,
    ],
    { maxBuffer: 50 * 1024 * 1024 }
  );

  const rawBlocks = logOut.split(COMMIT_SEP).map((b) => b.trim()).filter(Boolean);
  const bundles: CommitBundle[] = [];

  for (const block of rawBlocks) {
    const lines = block.split("\n");
    const hash = lines[0]?.trim();
    const subject = lines[1]?.trim() ?? "";
    const body = lines.slice(2).join("\n").trim();
    if (!hash) {
      continue;
    }

    const { stdout: diff } = await execFileAsync(
      "git",
      ["-C", repoRoot, "show", hash, "--no-color", "-p"],
      { maxBuffer: 50 * 1024 * 1024 }
    );

    bundles.push({ hash, subject, body, diff });
  }

  return bundles;
}
