package main

import (
	"database/sql"
	"fmt"
	"time"
	"context"
	"github.com/go-telegram/bot"
	"github.com/go-telegram/bot/models"
)

func muteUser(userId int64, chatId int64, duration time.Duration, b *bot.Bot, db *sql.DB, ctx context.Context) {
	until := time.Now().Add(duration)

	 
	var existingUntil time.Time
	err := db.QueryRow(`
		SELECT until FROM muted WHERE user_id = ? AND chat_id = ?
	`, userId, chatId).Scan(&existingUntil)

	if err != nil && err != sql.ErrNoRows {
		fmt.Println("Error while checking muted table:", err)
		return
	}

	 
	if err == nil {
		_, err = db.Exec(`
			UPDATE muted SET until = ? WHERE user_id = ? AND chat_id = ?
		`, until, userId, chatId)
		if err != nil {
			fmt.Println("Error while updating muted table:", err)
			return
		}
	} else {
		 
		_, err = db.Exec(`
			INSERT INTO muted (user_id, chat_id, until) VALUES (?, ?, ?)
		`, userId, chatId, until)
		if err != nil {
			fmt.Println("Error while inserting into muted table:", err)
			return
		}
	}

	 
	_, err = b.RestrictChatMember(ctx, &bot.RestrictChatMemberParams{
		ChatID: chatId,
		UserID: userId,
		Permissions: &models.ChatPermissions{
			CanSendMessages: false,
		},
		UntilDate: int(until.Unix()),
	})
	if err != nil {
		fmt.Println("Error while restricting chat member:", err)
		return
	}

	 
	_, err = b.SendMessage(ctx, &bot.SendMessageParams{
		ChatID: chatId,
		Text:   fmt.Sprintf("Пользователь с ID %d был замьючен на %s.", userId, duration.String()),
	})
	if err != nil {
		fmt.Println("Error while sending message:", err)
	}
}

func unmuteUser(userId int64, chatId int64, b *bot.Bot, db *sql.DB, ctx context.Context) {
	
	_, err := db.Exec(`
		DELETE FROM muted WHERE user_id = ? AND chat_id = ?
	`, userId, chatId)
	if err != nil {
		fmt.Println("Error while deleting from muted table:", err)
		return
	}

	
	_, err = b.RestrictChatMember(ctx, &bot.RestrictChatMemberParams{
		ChatID: chatId,
		UserID: userId,
		Permissions: &models.ChatPermissions{
			CanSendMessages: true,
		},
	})
	if err != nil {
		fmt.Println("Error while restricting chat member:", err)
		return
	}

	
	_, err = b.SendMessage(ctx, &bot.SendMessageParams{
		ChatID: chatId,
		Text:   fmt.Sprintf("Пользователь с ID %d был размьючен.", userId),
	})
	if err != nil {
		fmt.Println("Error while sending message:", err)
	}
}
