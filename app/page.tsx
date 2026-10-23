import data from "@/public/data.json";
import Dashboard from "@/components/Dashboard";
import type { MpfData } from "@/components/types";
export default function Home() { return <Dashboard data={data as unknown as MpfData} />; }
