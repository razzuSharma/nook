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
