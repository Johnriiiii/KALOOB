import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTrackingNumber, resolveTargetChapels } from './files.routes.js';

test('resolveTargetChapels uses all chapels for super admin bulk import', async () => {
  const chapels = [{ chapelId: 'st-joseph' }, { chapelId: 'our-lady' }];
  const targets = await resolveTargetChapels({ role: 'superadmin' }, 'all', chapels);
  assert.deepEqual(targets, ['st-joseph', 'our-lady']);
});

test('resolveTargetChapels limits church users to their own chapel', async () => {
  const chapels = [{ chapelId: 'st-joseph' }, { chapelId: 'our-lady' }];
  const targets = await resolveTargetChapels({ role: 'church', churchId: 'st-joseph' }, 'all', chapels);
  assert.deepEqual(targets, ['st-joseph']);
});

test('buildTrackingNumber formats the provided sequence consistently', () => {
  assert.equal(buildTrackingNumber('st-joseph', 12), 'KLB-STJ-0012');
});
