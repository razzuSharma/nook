export type RoomIconKey = "code" | "rocket" | "cpu" | "sparkles"
export type RoomAccess = "public" | "private" | "invite_only"

export type Room = {
  id: string
  name: string
  description: string
  mode: string
  access: RoomAccess
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
    access: "public",
    membersCount: 6,
    membersMax: 12,
    icon: "code",
  },
  {
    id: "room-saas-builders",
    name: "SaaS Builders",
    description: "Collaborating on the next generation of SaaS tools.",
    mode: "BUILD SPRINT",
    access: "public",
    membersCount: 2,
    membersMax: 8,
    icon: "rocket",
  },
  {
    id: "room-rust-study-group",
    name: "Rust Study Group",
    description: "Learning memory safety and performance together.",
    mode: "SESSION ACTIVE",
    access: "public",
    membersCount: 3,
    membersMax: 5,
    icon: "cpu",
  },
]
