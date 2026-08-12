ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'teacher_admin';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'popular_student_admin';

CREATE OR REPLACE FUNCTION public.is_content_contributor(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role::text = ANY (ARRAY['admin','teacher_admin','popular_student_admin'])
  )
$$;

REVOKE ALL ON FUNCTION public.is_content_contributor(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_content_contributor(uuid) TO authenticated, service_role;

-- Contributors may read questions (including drafts) so they can see what they added
CREATE POLICY "contributors read questions"
ON public.questions FOR SELECT TO authenticated
USING (public.is_content_contributor(auth.uid()));

-- Contributors may only insert drafts; no update/delete policies for them
CREATE POLICY "contributors insert drafts"
ON public.questions FOR INSERT TO authenticated
WITH CHECK (
  public.is_content_contributor(auth.uid())
  AND status = 'draft'::publish_status
);

-- Only the super admin (admin role) can assign or remove roles
CREATE POLICY "admin assigns roles"
ON public.user_roles FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "admin removes roles"
ON public.user_roles FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role) AND role::text <> 'admin');

GRANT SELECT, INSERT, DELETE ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;