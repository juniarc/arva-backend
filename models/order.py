from connector.db import db
from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, Text, func
from sqlalchemy.orm import relationship




class Order(db.Model):
    __tablename__ = "orders"
    order_id = db.Column(db.Integer, primary_key=True, autoincrement=True, nullable=False)
    user_id = db.Column(db.Integer, ForeignKey('users.user_id', ondelete='CASCADE'), nullable=False)
    total_amount = db.Column(db.Integer, nullable=False , default= 0)
    payment_amount = db.Column(db.Integer, nullable=True , default= 0)
    voucher_id = db.Column(db.Integer, ForeignKey('voucher.voucher_id', ondelete='CASCADE'), nullable=True)
    status = db.Column(db.String(20), nullable=False, default = 'pending')
    created_at = db.Column(db.DateTime(timezone=True), server_default=func.now())

    #relasi ke user
    user = relationship("User", back_populates="order", lazy=True)

    #relasi ke rating
    rating = relationship("Rating", back_populates="order", cascade="all, delete", lazy=True)

    #relasi ke order item
    order_item = relationship("OrderItem", back_populates="order", cascade="all, delete", lazy=True)



    def to_dict(self):
        return {
            "order_id": self.order_id,
            "user_id": self.user_id,
            "total_amount": self.total_amount,
            "status": self.status,
            "created_at": self.created_at,
            "voucher_id": self.voucher_id,
            "payment_amount": self.payment_amount
        }

    def __repr__(self):
        return f'<Order {self.order_id} {self.user_id} {self.total_amount} {self.status} {self.created_at} {self.voucher_id} {self.payment_amount}>'
