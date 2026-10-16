
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "admin_actions": {
                  Row: {
                    "action": Database["public"]['Enums']["admin_action_kind"],"admin_id": string,"created_at": string,"id": string,"reason": string,"target_report": string | null,"target_ride": string | null,"target_user": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "action": Database["public"]['Enums']["admin_action_kind"],"admin_id": string,"created_at"?: string,"id"?: string,"reason": string,"target_report"?: string | null,"target_ride"?: string | null,"target_user"?: string | null
                  }
                  Update: {
                    "action"?: Database["public"]['Enums']["admin_action_kind"],"admin_id"?: string,"created_at"?: string,"id"?: string,"reason"?: string,"target_report"?: string | null,"target_ride"?: string | null,"target_user"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "admin_actions_admin_id_fkey"
      columns: ["admin_id"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "admin_actions_target_report_fkey"
      columns: ["target_report"]
isOneToOne: false
      referencedRelation: "reports"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "admin_actions_target_ride_fkey"
      columns: ["target_ride"]
isOneToOne: false
      referencedRelation: "rides"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "admin_actions_target_user_fkey"
      columns: ["target_user"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    }
                  ]
                },"blocks": {
                  Row: {
                    "blocked_id": string,"blocker_id": string,"created_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "blocked_id": string,"blocker_id": string,"created_at"?: string
                  }
                  Update: {
                    "blocked_id"?: string,"blocker_id"?: string,"created_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "blocks_blocked_id_fkey"
      columns: ["blocked_id"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "blocks_blocker_id_fkey"
      columns: ["blocker_id"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    }
                  ]
                },"bookings": {
                  Row: {
                    "any_car_ok": boolean,"created_at": string,"decided_at": string | null,"drop_seq": number,"id": string,"pickup_seq": number,"rematch_requested": boolean,"ride_id": string,"rider_id": string,"seats": number,"status": Database["public"]['Enums']["booking_status"],"waitlist_rank": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "any_car_ok"?: boolean,"created_at"?: string,"decided_at"?: string | null,"drop_seq": number,"id"?: string,"pickup_seq": number,"rematch_requested"?: boolean,"ride_id": string,"rider_id": string,"seats"?: number,"status"?: Database["public"]['Enums']["booking_status"],"waitlist_rank"?: number | null
                  }
                  Update: {
                    "any_car_ok"?: boolean,"created_at"?: string,"decided_at"?: string | null,"drop_seq"?: number,"id"?: string,"pickup_seq"?: number,"rematch_requested"?: boolean,"ride_id"?: string,"rider_id"?: string,"seats"?: number,"status"?: Database["public"]['Enums']["booking_status"],"waitlist_rank"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "bookings_ride_id_drop_seq_fkey"
      columns: ["ride_id","drop_seq"]
isOneToOne: false
      referencedRelation: "ride_stops"
      referencedColumns: ["ride_id","seq"]
    },{
      foreignKeyName: "bookings_ride_id_fkey"
      columns: ["ride_id"]
isOneToOne: false
      referencedRelation: "rides"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "bookings_ride_id_pickup_seq_fkey"
      columns: ["ride_id","pickup_seq"]
isOneToOne: false
      referencedRelation: "ride_stops"
      referencedColumns: ["ride_id","seq"]
    },{
      foreignKeyName: "bookings_rider_id_fkey"
      columns: ["rider_id"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    }
                  ]
                },"cars": {
                  Row: {
                    "colour": string,"created_at": string,"id": string,"model": string,"owner_id": string,"photo_paths": (string)[],"plate": string,"seats_total": number
                  }
                  ComputedFields: never
                  Insert: {
                    "colour": string,"created_at"?: string,"id"?: string,"model": string,"owner_id": string,"photo_paths"?: (string)[],"plate": string,"seats_total": number
                  }
                  Update: {
                    "colour"?: string,"created_at"?: string,"id"?: string,"model"?: string,"owner_id"?: string,"photo_paths"?: (string)[],"plate"?: string,"seats_total"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "cars_owner_id_fkey"
      columns: ["owner_id"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    }
                  ]
                },"notifications_outbox": {
                  Row: {
                    "attempts": number,"created_at": string,"id": string,"kind": string,"payload": NonNullable<Json>,"sent_at": string | null,"status": Database["public"]['Enums']["outbox_status"],"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "attempts"?: number,"created_at"?: string,"id"?: string,"kind": string,"payload"?: NonNullable<Json>,"sent_at"?: string | null,"status"?: Database["public"]['Enums']["outbox_status"],"user_id": string
                  }
                  Update: {
                    "attempts"?: number,"created_at"?: string,"id"?: string,"kind"?: string,"payload"?: NonNullable<Json>,"sent_at"?: string | null,"status"?: Database["public"]['Enums']["outbox_status"],"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "notifications_outbox_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    }
                  ]
                },"places": {
                  Row: {
                    "created_at": string,"geo": unknown,"id": string,"kind": Database["public"]['Enums']["place_kind"],"name": string,"use_count": number
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"geo": unknown,"id"?: string,"kind"?: Database["public"]['Enums']["place_kind"],"name": string,"use_count"?: number
                  }
                  Update: {
                    "created_at"?: string,"geo"?: unknown,"id"?: string,"kind"?: Database["public"]['Enums']["place_kind"],"name"?: string,"use_count"?: number
                  }
                  Relationships: [
                    
                  ]
                },"push_subscriptions": {
                  Row: {
                    "auth": string,"created_at": string,"endpoint": string,"p256dh": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "auth": string,"created_at"?: string,"endpoint": string,"p256dh": string,"user_id": string
                  }
                  Update: {
                    "auth"?: string,"created_at"?: string,"endpoint"?: string,"p256dh"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "push_subscriptions_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    }
                  ]
                },"reliability_events": {
                  Row: {
                    "booking_id": string | null,"created_at": string,"disputed": boolean,"id": string,"kind": Database["public"]['Enums']["reliability_event_kind"],"points": number,"resolved_by": string | null,"ride_id": string | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "booking_id"?: string | null,"created_at"?: string,"disputed"?: boolean,"id"?: string,"kind": Database["public"]['Enums']["reliability_event_kind"],"points": number,"resolved_by"?: string | null,"ride_id"?: string | null,"user_id": string
                  }
                  Update: {
                    "booking_id"?: string | null,"created_at"?: string,"disputed"?: boolean,"id"?: string,"kind"?: Database["public"]['Enums']["reliability_event_kind"],"points"?: number,"resolved_by"?: string | null,"ride_id"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "reliability_events_booking_id_fkey"
      columns: ["booking_id"]
isOneToOne: false
      referencedRelation: "bookings"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "reliability_events_resolved_by_fkey"
      columns: ["resolved_by"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "reliability_events_ride_id_fkey"
      columns: ["ride_id"]
isOneToOne: false
      referencedRelation: "rides"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "reliability_events_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    }
                  ]
                },"reports": {
                  Row: {
                    "about_user": string,"by_user": string,"created_at": string,"id": string,"reason": string,"resolved_at": string | null,"ride_id": string | null,"status": Database["public"]['Enums']["report_status"]
                  }
                  ComputedFields: never
                  Insert: {
                    "about_user": string,"by_user": string,"created_at"?: string,"id"?: string,"reason": string,"resolved_at"?: string | null,"ride_id"?: string | null,"status"?: Database["public"]['Enums']["report_status"]
                  }
                  Update: {
                    "about_user"?: string,"by_user"?: string,"created_at"?: string,"id"?: string,"reason"?: string,"resolved_at"?: string | null,"ride_id"?: string | null,"status"?: Database["public"]['Enums']["report_status"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "reports_about_user_fkey"
      columns: ["about_user"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "reports_by_user_fkey"
      columns: ["by_user"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "reports_ride_id_fkey"
      columns: ["ride_id"]
isOneToOne: false
      referencedRelation: "rides"
      referencedColumns: ["id"]
    }
                  ]
                },"reviews": {
                  Row: {
                    "booking_id": string,"comment": string | null,"created_at": string,"from_user": string,"stars": number,"to_user": string
                  }
                  ComputedFields: never
                  Insert: {
                    "booking_id": string,"comment"?: string | null,"created_at"?: string,"from_user": string,"stars": number,"to_user": string
                  }
                  Update: {
                    "booking_id"?: string,"comment"?: string | null,"created_at"?: string,"from_user"?: string,"stars"?: number,"to_user"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "reviews_booking_id_fkey"
      columns: ["booking_id"]
isOneToOne: false
      referencedRelation: "bookings"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "reviews_from_user_fkey"
      columns: ["from_user"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "reviews_to_user_fkey"
      columns: ["to_user"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    }
                  ]
                },"ride_stops": {
                  Row: {
                    "eta_offset_min": number,"geo": unknown,"label": string,"place_id": string | null,"ride_id": string,"seq": number
                  }
                  ComputedFields: never
                  Insert: {
                    "eta_offset_min"?: number,"geo": unknown,"label": string,"place_id"?: string | null,"ride_id": string,"seq": number
                  }
                  Update: {
                    "eta_offset_min"?: number,"geo"?: unknown,"label"?: string,"place_id"?: string | null,"ride_id"?: string,"seq"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "ride_stops_place_id_fkey"
      columns: ["place_id"]
isOneToOne: false
      referencedRelation: "places"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "ride_stops_ride_id_fkey"
      columns: ["ride_id"]
isOneToOne: false
      referencedRelation: "rides"
      referencedColumns: ["id"]
    }
                  ]
                },"rides": {
                  Row: {
                    "allocation_at": string,"car_id": string,"created_at": string,"depart_at": string,"id": string,"notes": string | null,"owner_id": string,"price_per_seat": number,"seats_left": number,"seats_total": number,"status": Database["public"]['Enums']["ride_status"],"usual_ride_id": string | null,"women_only": boolean
                  }
                  ComputedFields: never
                  Insert: {
                    "allocation_at": string,"car_id": string,"created_at"?: string,"depart_at": string,"id"?: string,"notes"?: string | null,"owner_id": string,"price_per_seat": number,"seats_left": number,"seats_total": number,"status"?: Database["public"]['Enums']["ride_status"],"usual_ride_id"?: string | null,"women_only"?: boolean
                  }
                  Update: {
                    "allocation_at"?: string,"car_id"?: string,"created_at"?: string,"depart_at"?: string,"id"?: string,"notes"?: string | null,"owner_id"?: string,"price_per_seat"?: number,"seats_left"?: number,"seats_total"?: number,"status"?: Database["public"]['Enums']["ride_status"],"usual_ride_id"?: string | null,"women_only"?: boolean
                  }
                  Relationships: [
                    {
      foreignKeyName: "rides_car_id_owner_id_fkey"
      columns: ["car_id","owner_id"]
isOneToOne: false
      referencedRelation: "cars"
      referencedColumns: ["id","owner_id"]
    },{
      foreignKeyName: "rides_owner_id_fkey"
      columns: ["owner_id"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "rides_usual_ride_id_fkey"
      columns: ["usual_ride_id"]
isOneToOne: false
      referencedRelation: "usual_rides"
      referencedColumns: ["id"]
    }
                  ]
                },"signup_tokens": {
                  Row: {
                    "created_at": string,"created_by": string,"expires_at": string,"max_uses": number,"token": string,"used_count": number
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by": string,"expires_at": string,"max_uses"?: number,"token": string,"used_count"?: number
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string,"expires_at"?: string,"max_uses"?: number,"token"?: string,"used_count"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "signup_tokens_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    }
                  ]
                },"users": {
                  Row: {
                    "created_at": string,"gender": string | null,"home_place_id": string | null,"id": string,"is_admin": boolean,"late_cancels_90d": number,"name": string,"no_shows_90d": number,"phone": string | null,"photo_url": string | null,"reliability_score": number,"rides_completed": number,"upi_vpa": string | null,"work_place_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"gender"?: string | null,"home_place_id"?: string | null,"id": string,"is_admin"?: boolean,"late_cancels_90d"?: number,"name": string,"no_shows_90d"?: number,"phone"?: string | null,"photo_url"?: string | null,"reliability_score"?: number,"rides_completed"?: number,"upi_vpa"?: string | null,"work_place_id"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"gender"?: string | null,"home_place_id"?: string | null,"id"?: string,"is_admin"?: boolean,"late_cancels_90d"?: number,"name"?: string,"no_shows_90d"?: number,"phone"?: string | null,"photo_url"?: string | null,"reliability_score"?: number,"rides_completed"?: number,"upi_vpa"?: string | null,"work_place_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "users_home_place_id_fkey"
      columns: ["home_place_id"]
isOneToOne: false
      referencedRelation: "places"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "users_work_place_id_fkey"
      columns: ["work_place_id"]
isOneToOne: false
      referencedRelation: "places"
      referencedColumns: ["id"]
    }
                  ]
                },"usual_rides": {
                  Row: {
                    "auto_golive_days": number,"car_id": string,"created_at": string,"depart_time": string,"id": string,"notes": string | null,"owner_id": string,"price_per_seat": number,"seats_offered": number,"stops": NonNullable<Json>,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "auto_golive_days"?: number,"car_id": string,"created_at"?: string,"depart_time": string,"id"?: string,"notes"?: string | null,"owner_id": string,"price_per_seat": number,"seats_offered": number,"stops": NonNullable<Json>,"updated_at"?: string
                  }
                  Update: {
                    "auto_golive_days"?: number,"car_id"?: string,"created_at"?: string,"depart_time"?: string,"id"?: string,"notes"?: string | null,"owner_id"?: string,"price_per_seat"?: number,"seats_offered"?: number,"stops"?: NonNullable<Json>,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "usual_rides_car_id_owner_id_fkey"
      columns: ["car_id","owner_id"]
isOneToOne: false
      referencedRelation: "cars"
      referencedColumns: ["id","owner_id"]
    },{
      foreignKeyName: "usual_rides_owner_id_fkey"
      columns: ["owner_id"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "anonymise_account":
{ Args: { "p_user_id": string }; Returns: (string)[]
                           },
"cancel_ride":
{ Args: { "p_owner_id": string,"p_reason"?: string,"p_ride_id": string }; Returns: number
                           },
"get_car_private":
{ Args: { "p_car_id": string }; Returns: {
              "photo_paths": (string)[],"plate": string
            }[]
                           },
"get_contact":
{ Args: { "p_user_id": string }; Returns: {
              "name": string,"phone": string,"upi_vpa": string
            }[]
                           },
"get_my_profile":
{ Args: Record<PropertyKey, never>; Returns: {
              "created_at": string,
"gender": string | null,
"home_place_id": string | null,
"id": string,
"is_admin": boolean,
"late_cancels_90d": number,
"name": string,
"no_shows_90d": number,
"phone": string | null,
"photo_url": string | null,
"reliability_score": number,
"rides_completed": number,
"upi_vpa": string | null,
"work_place_id": string | null
            }[]
                          SetofOptions: {
        from: "*"
        to: "users"
        isOneToOne: false
        isSetofReturn: true
      } },
"get_public_ride":
{ Args: { "p_ride_id": string }; Returns: {
              "depart_at": string,"owner_first_name": string,"price_per_seat": number,"ride_id": string,"seats_left": number,"status": Database["public"]['Enums']["ride_status"],"stops": Json,"women_only": boolean
            }[]
                           },
"get_reliability":
{ Args: { "p_user_id": string }; Returns: {
              "late_cancels_90d": number,"no_shows_90d": number,"reliability_score": number,"rides_completed": number
            }[]
                           },
"go_live":
{ Args: { "p_date": string,"p_depart_time"?: string,"p_owner_id": string,"p_seats"?: number,"p_usual_ride_id": string }; Returns: {
              "created": boolean,"ride_id": string
            }[]
                           },
"list_places":
{ Args: Record<PropertyKey, never>; Returns: {
              "id": string,"kind": Database["public"]['Enums']["place_kind"],"lat": number,"lng": number,"name": string
            }[]
                           },
"redeem_invite":
{ Args: { "p_name": string,"p_photo_url": string,"p_token": string,"p_user_id": string }; Returns: boolean
                           }
          }
          Enums: {
            "admin_action_kind": "REMOVE_USER"|"RESTORE_USER"|"HIDE_RIDE"|"UNHIDE_RIDE"|"RESOLVE_REPORT"|"DISMISS_REPORT","booking_status": "REQUESTED"|"CONFIRMED"|"WAITLISTED"|"DECLINED"|"CANCELLED"|"EXPIRED"|"COMPLETED"|"NO_SHOW","outbox_status": "PENDING"|"SENT"|"FAILED","place_kind": "landmark"|"metro"|"office"|"town","reliability_event_kind": "COMPLETED"|"NO_SHOW"|"LATE_CANCEL"|"OWNER_LATE_CANCEL","report_status": "OPEN"|"RESOLVED"|"DISMISSED","ride_status": "OPEN"|"ALLOCATING"|"FULL"|"STARTED"|"COMPLETED"|"CANCELLED"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            "admin_action_kind": ["REMOVE_USER", "RESTORE_USER", "HIDE_RIDE", "UNHIDE_RIDE", "RESOLVE_REPORT", "DISMISS_REPORT"],"booking_status": ["REQUESTED", "CONFIRMED", "WAITLISTED", "DECLINED", "CANCELLED", "EXPIRED", "COMPLETED", "NO_SHOW"],"outbox_status": ["PENDING", "SENT", "FAILED"],"place_kind": ["landmark", "metro", "office", "town"],"reliability_event_kind": ["COMPLETED", "NO_SHOW", "LATE_CANCEL", "OWNER_LATE_CANCEL"],"report_status": ["OPEN", "RESOLVED", "DISMISSED"],"ride_status": ["OPEN", "ALLOCATING", "FULL", "STARTED", "COMPLETED", "CANCELLED"]
          }
        }
} as const
