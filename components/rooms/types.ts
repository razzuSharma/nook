export type RoomIconKey = "code" | "rocket" | "cpu" | "sparkles"

export type Room = {
  id: string
  name: string
  description: string
  mode: string
  membersCount: number
  membersMax: number
  icon: RoomIconKey
}

export const defaultRooms: Room[] = [
  {
    id: "room-react-wizards",
    name: "React Wizards",
    description: "Frontend architecture and component optimization.",
    mode: "CAFE MODE",
    membersCount: 6,
    membersMax: 12,
    icon: "code",
  },
  {
    id: "room-saas-builders",
    name: "SaaS Builders",
    description: "Collaborating on the next generation of SaaS tools.",
    mode: "BUILD SPRINT",
    membersCount: 2,
    membersMax: 8,
    icon: "rocket",
  },
  {
    id: "room-rust-study-group",
    name: "Rust Study Group",
    description: "Learning memory safety and performance together.",
    mode: "SESSION ACTIVE",
    membersCount: 3,
    membersMax: 5,
    icon: "cpu",
  },
]
