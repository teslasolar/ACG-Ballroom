import { loadTemplates, loadInstances } from './loader.mjs';
import { validate } from './validate.mjs';

const templates = loadTemplates();
const instances = loadInstances();
const r = validate(templates, instances);

console.log(`templates: ${r.counts.templates}  instances: ${r.counts.instances}  errors: ${r.counts.errors}`);
if (!r.ok) {
  for (const e of r.errors) console.log('  ' + e);
  process.exit(1);
}
console.log('ALL PASS');
