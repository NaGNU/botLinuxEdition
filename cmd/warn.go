package main

import (
	"context"
	"database/sql"
	"fmt"
	"github.com/go-telegram/bot"
)


func warnUser(userId int64, chatId int64, b *bot.Bot, db *sql.DB, ctx context.Context) {
	
	result, err := db.Exec(`
		INSERT INTO warned (user_id, chat_id) VALUES (?, ?)
	`, userId, chatId)
	if err != nil {
		fmt.Println("Error while inserting into warned table:", err)
		return
	}

	
	id, err := result.LastInsertId()
	if err != nil {
		fmt.Println("Error while getting the last inserted id:", err)
		return
	}

	
	_, err = b.SendMessage(ctx, &bot.SendMessageParams{
		ChatID: chatId,
		Text:   fmt.Sprintf("Пользователь с ID %d был предупрежден (ID предупреждения: %d).", userId, id),
	})
	if err != nil {
		fmt.Println("Error while sending message:", err)
	}
}


func unwarnUser(userId int64, chatId int64, id int64, b *bot.Bot, db *sql.DB, ctx context.Context) {
	
	_, err := db.Exec(`
		DELETE FROM warned WHERE id = ? AND user_id = ? AND chat_id = ?
	`, id, userId, chatId)
	if err != nil {
		fmt.Println("Error while deleting from warned table:", err)
		return
	}

	
	_, err = b.SendMessage(ctx, &bot.SendMessageParams{
		ChatID: chatId,
		Text:   fmt.Sprintf("Предупреждение с ID %d для пользователя с ID %d было снято.", id, userId),
	})
	if err != nil {
		fmt.Println("Error while sending message:", err)
	}
}
