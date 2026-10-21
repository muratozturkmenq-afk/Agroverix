begin;
set local lock_timeout = '5s';
alter table public.farmer_operations drop constraint farmer_operations_type_v2;
alter table public.farmer_operations add constraint farmer_operations_type_v2 check (operation_type in ('soil_analysis','tillage','seed','planting','fertilizing','irrigation','spraying','weeding','harvest','other','hoeing','machine_spraying','machine_fertilizing','labor','pruning','machine_other'));
commit;
