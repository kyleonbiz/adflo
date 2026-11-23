-- Pricing update after the first plan migration: Core + is $59/month with 3 seats included, and Enterprise has no set
-- price (quoted per customer, stored as 0). A client with its own price keeps it. Seats already given to clients are not changed.
update public.plans set price_cents = 5900, seats_included = 3 where lower(name) = 'core +';
update public.plans set price_cents = 0 where lower(name) = 'enterprise';
