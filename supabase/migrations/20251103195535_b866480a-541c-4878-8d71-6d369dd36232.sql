-- Grant admin role to the host user
INSERT INTO public.user_roles (user_id, role)
VALUES ('10063a14-caad-4da3-831c-19a0a126d6e9', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;