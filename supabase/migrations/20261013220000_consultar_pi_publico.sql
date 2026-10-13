-- Preenchimento do formulário do veículo: devolve só campanha, veículo, tipo e praça de um PI emitido.
-- Valores, comissão e demais dados do PI não saem daqui.
create function public.consultar_pi(p_cliente text, p_numero text)
returns jsonb language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'campanha', p.campanha,
    'nome_veiculo', v.nome,
    'tipo_veiculo', v.tipo_veiculo,
    'praca', coalesce(v.praca, nullif(concat_ws(' - ', v.municipio, v.uf), ''))
  )
  from public.pedidos_insercao p
  join public.clientes c on c.id = p.cliente_id
  join public.veiculos v on v.id = p.veiculo_id
  where c.nome = p_cliente
    and p.status = 'emitido'
    and regexp_replace(p_numero, '\D', '', 'g') <> ''
    and p.numero::text = regexp_replace(p_numero, '\D', '', 'g')
  order by p.created_at desc
  limit 1
$$;
revoke all on function public.consultar_pi(text, text) from public;
grant execute on function public.consultar_pi(text, text) to anon, authenticated;
