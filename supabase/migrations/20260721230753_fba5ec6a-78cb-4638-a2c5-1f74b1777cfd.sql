ALTER PUBLICATION supabase_realtime ADD TABLE public.portfolio_items;
ALTER TABLE public.portfolio_items REPLICA IDENTITY FULL;