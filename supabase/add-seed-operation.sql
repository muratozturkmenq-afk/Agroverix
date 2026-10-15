begin;
alter table public.farmer_operations drop constraint if exists farmer_operations_operation_type_check;
alter table public.farmer_operations add constraint farmer_operations_operation_type_check check (operation_type in ('tillage','seed','planting','fertilizing','irrigation','spraying','weeding','harvest','other'));
commit;
