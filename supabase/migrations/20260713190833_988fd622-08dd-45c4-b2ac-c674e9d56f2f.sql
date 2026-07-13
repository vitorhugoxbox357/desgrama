
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _role app_role;
  _client_id UUID;
BEGIN
  _role := COALESCE((NEW.raw_user_meta_data->>'role')::app_role, 'client');
  BEGIN
    _client_id := NULLIF(NEW.raw_user_meta_data->>'client_id','')::UUID;
  EXCEPTION WHEN others THEN _client_id := NULL;
  END;

  INSERT INTO public.profiles (id, email, full_name, client_id)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email), _client_id);
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, _role);
  RETURN NEW;
END; $$;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
