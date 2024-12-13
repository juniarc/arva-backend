# from connector.db import db
# from sqlalchemy import Column, Integer, String, ForeignKey, Text, DateTime, func
# from sqlalchemy.orm import relationship


# class Rating(db.Model):
#     __tablename__ = "rating"
#     rating_id = db.Column(db.Integer, primary_key=True, autoincrement=True, nullable=False)
#     user_id = db.Column(db.Integer, ForeignKey('users.user_id'), ondelete='CASCADE', nullable=False)
#     product_id = db.Column(db.Integer, ForeignKey('products.product_id'), ondelete='CASCADE', nullable=False)
#     order_id = db.Column(db.Integer, ForeignKey('orders.order_id'), ondelete='CASCADE', nullable=False)
#     rating_product = db.Column(db.Integer, nullable=False)
#     review = db.Column(db.Text, nullable=True)
#     created_at = db.Column(db.DateTime(timezone=True), server_default=func.now())
    
    
#     user = relationship("User", back_populates="rating", lazy=True)
    
#     product = relationship("Product", back_populates="rating", lazy=True)

#     order= relationship("Order", back_populates="rating", lazy=True)

#     def __repr__(self):
#         return f'<Rating {self.rating_id} {self.user_id} {self.product_id} {self.rating} {self.created_at}>'
    
#     def to_dict(self):
#         return {
#             "rating_id": self.rating_id,
#             "user_id": self.user_id,
#             "product_id": self.product_id,
#             "rating": self.rating,
#             "created_at": self.created_at
#         }