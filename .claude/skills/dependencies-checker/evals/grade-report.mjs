function sameArray(left, right) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function check(id, passed, evidence) {
  return { id, passed, evidence };
}

export function gradeReport(report, expected) {
  const checks = [];
  const workspaces = [...(report.packages || [])].map((item) => item.workspace).sort();
  checks.push(
    check(
      'workspaces',
      sameArray(workspaces, [...expected.required_workspaces].sort()),
      workspaces,
    ),
  );
  for (const required of expected.required_dependencies || []) {
    const dependency = (report.dependencies || []).find(
      (item) => item.workspace === required.workspace && item.package === required.package,
    );
    checks.push(
      check(
        `dependency:${required.workspace}:${required.package}`,
        dependency?.kind === required.kind && dependency.size_status === 'unavailable',
        dependency || null,
      ),
    );
  }
  const expectedCycle = [...(expected.required_cycle || [])].sort();
  const cycle = (report.cycles || []).find((item) => sameArray([...item.members].sort(), expectedCycle));
  checks.push(check('internal-cycle', Boolean(cycle), cycle || null));
  const duplicate = (report.duplicates || []).find(
    (item) =>
      item.package === expected.required_duplicate?.package &&
      sameArray([...item.versions].sort(), [...(expected.required_duplicate?.versions || [])].sort()),
  );
  checks.push(check('duplicate-resolution', Boolean(duplicate), duplicate || null));
  const alias = (report.internal_edges || []).find(
    (item) => Object.entries(expected.required_alias_edge || {}).every(([key, value]) => item[key] === value),
  );
  checks.push(check('alias-edge', Boolean(alias), alias || null));
  const cycleRecommendation = (report.recommendations || []).find(
    (item) => item.priority === 'P0' && item.kind === 'internal-import-cycle',
  );
  checks.push(check('p0-cycle-priority', Boolean(cycleRecommendation), cycleRecommendation || null));
  const passed = checks.filter((item) => item.passed).length;
  return {
    pass: passed === checks.length,
    totals: { passed, required: checks.length },
    precision: checks.length ? passed / checks.length : 1,
    recall: checks.length ? passed / checks.length : 1,
    checks,
  };
}
