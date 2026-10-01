import { expect, test } from '@playwright/test';
import { backendUrl } from '../config';
import { getAdminToken } from '../helpers/api';

const routes = [
  { method: 'POST', path: '/admin/emails', file: 'attachments', fields: 3 },
  { method: 'POST', path: '/admin/emails/test', file: 'attachments', fields: 3 },
  { method: 'POST', path: '/admin/members/import', file: 'file', fields: 1 },
  { method: 'PATCH', path: '/admin/personal-info/config', file: 'recipients', fields: 6 },
] as const;

for (const route of routes) {
  test.describe(`${route.method} ${route.path} multipart limits`, () => {
    test('anonymous crafted multipart remains unauthorized', async () => {
      const body = new FormData();
      body.append('a[4294967295]', 'x');
      body.append('a[]', 'y');
      const response = await fetch(backendUrl(route.path), { method: route.method, body });
      expect(response.status).toBe(401);
    });

    test('rejects crafted fields and leaves backend responsive', async () => {
      const token = await getAdminToken();
      for (const name of ['a[4294967295]', 'a[]', 'a[b][c]', 'x'.repeat(101)]) {
        const body = new FormData();
        body.append(name, 'x');
        body.append('a[]', 'y');
        const response = await fetch(backendUrl(route.path), {
          method: route.method,
          headers: { Authorization: `Bearer ${token}` },
          body,
        });
        expect(response.status, await response.text()).toBe(400);
      }
      const alive = await fetch(backendUrl('/admin/members'), {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(alive.status).toBe(200);
    });

    test('rejects excess fields and oversized files', async () => {
      const token = await getAdminToken();
      const headers = { Authorization: `Bearer ${token}` };
      const fields = new FormData();
      for (let i = 0; i <= route.fields; i++) fields.append(`field${i}`, 'x');
      const tooMany = await fetch(backendUrl(route.path), { method: route.method, headers, body: fields });
      expect(tooMany.status, await tooMany.text()).toBe(400);

      const files = new FormData();
      files.append(route.file, new Blob([new Uint8Array(5 * 1024 * 1024 + 1)]), 'large.csv');
      const tooLarge = await fetch(backendUrl(route.path), { method: route.method, headers, body: files });
      expect(tooLarge.status, await tooLarge.text()).toBe(413);
    });
  });
}
