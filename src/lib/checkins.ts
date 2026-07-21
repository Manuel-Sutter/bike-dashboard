import { getSupabaseServerClient } from "./supabase";

export interface Checkin {
  date: string;
  kneeStatus: number;
}

export async function getRecentCheckins(days = 30): Promise<Checkin[]> {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("checkins")
    .select("date, knee_status")
    .gte("date", since.toISOString().slice(0, 10))
    .order("date", { ascending: true });

  if (error) throw error;

  return (data ?? []).map((row) => ({ date: row.date, kneeStatus: row.knee_status }));
}

export async function getTodayCheckin(): Promise<Checkin | null> {
  const today = new Date().toISOString().slice(0, 10);
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("checkins")
    .select("date, knee_status")
    .eq("date", today)
    .maybeSingle();

  if (error) throw error;
  return data ? { date: data.date, kneeStatus: data.knee_status } : null;
}

export async function upsertTodayCheckin(kneeStatus: number): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  const supabase = getSupabaseServerClient();
  const { error } = await supabase
    .from("checkins")
    .upsert({ date: today, knee_status: kneeStatus }, { onConflict: "date" });

  if (error) throw error;
}
