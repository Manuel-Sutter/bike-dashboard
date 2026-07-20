import styles from "./page.module.css";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const params = await searchParams;

  return (
    <div className={styles.wrap}>
      <form method="POST" action="/api/login" className={styles.card}>
        <span className={styles.title}>Bike Dashboard</span>
        <input type="hidden" name="next" value={params.next ?? "/"} />
        <input
          className={styles.input}
          type="password"
          name="password"
          placeholder="Password"
          autoFocus
          required
        />
        {params.error && <span className={styles.error}>Wrong password.</span>}
        <button className={styles.button} type="submit">
          Sign in
        </button>
      </form>
    </div>
  );
}
