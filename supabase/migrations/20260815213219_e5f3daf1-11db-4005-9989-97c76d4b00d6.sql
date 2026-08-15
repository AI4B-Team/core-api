INSERT INTO public.memberships (user_id, workspace_id, role)
SELECT '3c271376-6724-4621-8a4d-5ff3bae344bf', w.id, 'owner'
FROM public.workspaces w
WHERE w.id = '83c01dd3-a1d4-4eeb-9ec5-eae1b1f2c6f7'
ON CONFLICT DO NOTHING;

INSERT INTO public.account_memberships (user_id, account_id, role)
SELECT '3c271376-6724-4621-8a4d-5ff3bae344bf', w.account_id, 'owner'
FROM public.workspaces w
WHERE w.id = '83c01dd3-a1d4-4eeb-9ec5-eae1b1f2c6f7'
ON CONFLICT DO NOTHING;